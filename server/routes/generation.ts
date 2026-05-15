import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { db } from '../db/pool';
import * as openrouter from '../services/openrouter';
import { buildPrompt } from '../services/prompts';

const TEMP_DIR = process.env.PHOTO_TEMP_DIR || '/var/www/ai-fotosessia.ru/temp-photos';
const TTL_MIN = Number(process.env.PHOTO_TTL_MINUTES ?? 30);

const router = Router();

interface SingleRequest {
  customerKey?: string;
  styleId?: string;
  sourcePhotoFilename?: string;
  customPrompt?: string;
  isFullBody?: boolean;
  originalDimensions?: { width: number; height: number };
}

async function refundCredit(accountId: string, generationId: string, reason: string) {
  // best-effort, не падаем
  try {
    await db.query(
      `UPDATE credit_accounts SET balance = balance + 1 WHERE id = $1`,
      [accountId],
    );
    await db.query(
      `INSERT INTO credit_transactions (account_id, type, amount, idempotency_key, description)
         VALUES ($1, 'refund', 1, $2, $3)
         ON CONFLICT (idempotency_key) DO NOTHING`,
      [accountId, `refund_gen_${generationId}`, reason.slice(0, 200)],
    );
    await db.query(
      `UPDATE generations SET status='error', error_message=$1 WHERE id=$2`,
      [reason.slice(0, 500), generationId],
    );
  } catch (e: any) {
    console.error('[gen/single] refund failed:', e?.message);
  }
}

// POST /api/generation/single
// body: { customerKey, styleId, sourcePhotoFilename, customPrompt, isFullBody, originalDimensions }
router.post('/single', async (req, res) => {
  try {
    const body = (req.body ?? {}) as SingleRequest;
    const customerKey = (body.customerKey ?? '').trim();
    const styleId = (body.styleId ?? '').trim();
    const sourcePhotoFilename = body.sourcePhotoFilename ?? '';

    if (!customerKey) {
      return res.status(400).json({ error: 'customerKey required', code: 'missing_customer_key' });
    }
    if (!styleId) {
      return res.status(400).json({ error: 'styleId required', code: 'missing_style_id' });
    }
    if (!sourcePhotoFilename) {
      return res.status(400).json({ error: 'sourcePhotoFilename required', code: 'missing_source' });
    }

    // === 1. Load source photo from temp dir ===
    const safeName = path.basename(sourcePhotoFilename);
    const srcPath = path.join(TEMP_DIR, safeName);
    if (!srcPath.startsWith(path.resolve(TEMP_DIR))) {
      return res.status(400).json({ error: 'Bad filename' });
    }

    let imageInputDataUrl: string;
    try {
      const stat = await fs.stat(srcPath);
      const ageMin = (Date.now() - stat.mtimeMs) / 60_000;
      if (ageMin > TTL_MIN) {
        return res.status(410).json({ error: 'Source photo expired. Загрузите заново.', code: 'source_expired' });
      }
      const buf = await fs.readFile(srcPath);
      const mime = safeName.endsWith('.png') ? 'image/png'
                 : safeName.endsWith('.webp') ? 'image/webp'
                 : 'image/jpeg';
      imageInputDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return res.status(404).json({ error: 'Source photo not found', code: 'source_missing' });
    }

    // === 2. Resolve style prompt server-side — never trust client ===
    const { rows: styleRows } = await db.query(
      `SELECT prompt FROM styles WHERE id = $1 AND active = true LIMIT 1`,
      [styleId],
    );
    if (!styleRows[0]) {
      return res.status(400).json({ error: 'Style not found', code: 'invalid_style_id' });
    }
    const stylePrompt = styleRows[0].prompt as string;

    // === 3. Atomic debit + create generation row ===
    const generationId = crypto.randomUUID();
    const debitKey = `debit_gen_${generationId}`;
    let accountId: string;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows: accRows } = await client.query(
        `SELECT id, balance FROM credit_accounts WHERE customer_key = $1 FOR UPDATE`,
        [customerKey],
      );
      const account = accRows[0];
      if (!account) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Кошелёк не найден. Купите пакет, чтобы начать.',
          balance: 0,
          code: 'no_account',
        });
      }
      if (account.balance < 1) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Недостаточно кредитов. Купите пакет, чтобы продолжить.',
          balance: account.balance,
          code: 'insufficient_balance',
        });
      }
      accountId = account.id;

      await client.query(
        `UPDATE credit_accounts SET balance = balance - 1 WHERE id = $1`,
        [account.id],
      );
      await client.query(
        `INSERT INTO credit_transactions (account_id, type, amount, idempotency_key, description)
           VALUES ($1, 'debit', 1, $2, $3)`,
        [account.id, debitKey, `Studio generation ${generationId}`],
      );
      await client.query(
        `INSERT INTO generations (id, customer_key, style_id, status, custom_prompt, is_full_body)
           VALUES ($1, $2, $3, 'running', $4, $5)`,
        [generationId, customerKey, body.styleId ?? null, body.customPrompt ?? null, !!body.isFullBody],
      );

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error('[gen/single] debit tx failed:', e?.message);
      return res.status(500).json({ error: 'Internal error during credit debit' });
    }
    client.release();

    // === 4. Aspect ratio ===
    let aspectRatio: string | undefined;
    const dim = body.originalDimensions;
    if (dim?.width && dim?.height) {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const d = gcd(dim.width, dim.height);
      aspectRatio = `${dim.width / d}:${dim.height / d}`;
    }

    // === 5. Build prompt + call OpenRouter ===
    const prompt = buildPrompt({
      stylePrompt,
      customPrompt: body.customPrompt,
      isFullBody: !!body.isFullBody,
      aspectRatio,
    });

    let aiResult: openrouter.GenerateImageResult;
    try {
      aiResult = await openrouter.generateImage({
        prompt,
        imageInput: imageInputDataUrl,
      });
    } catch (e: any) {
      const reason = `${e?.code || 'ai_error'}: ${e?.message || 'unknown'}`;
      console.error(`[gen/single] OpenRouter error for ${generationId}:`, reason);
      await refundCredit(accountId!, generationId, reason);

      const status = e?.status >= 400 && e?.status < 600 ? e.status : 502;
      const userMsg = e?.code === 'no_api_key'
        ? 'Сервис генерации временно недоступен. Кредит возвращён.'
        : e?.code === 'timeout'
          ? 'Генерация заняла слишком долго. Кредит возвращён, попробуйте ещё раз.'
          : 'Ошибка генерации. Кредит возвращён, попробуйте ещё раз.';

      const { rows: balRows } = await db.query(
        `SELECT balance FROM credit_accounts WHERE id = $1`,
        [accountId!],
      );

      return res.status(status).json({
        error: userMsg,
        code: e?.code,
        refunded: true,
        balance: balRows[0]?.balance ?? 0,
      });
    }

    // === 6. Save result image to temp dir ===
    const m = aiResult.imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) {
      const reason = 'ai_returned_non_image';
      console.error(`[gen/single] ${reason}`);
      await refundCredit(accountId!, generationId, reason);
      const { rows: balRows } = await db.query(
        `SELECT balance FROM credit_accounts WHERE id = $1`,
        [accountId!],
      );
      return res.status(502).json({
        error: 'AI вернул некорректный ответ. Кредит возвращён.',
        refunded: true,
        balance: balRows[0]?.balance ?? 0,
      });
    }

    const ext = m[1] === 'png' ? '.png' : '.jpg';
    const resultName = `gen_${generationId}${ext}`;
    const resultPath = path.join(TEMP_DIR, resultName);
    await fs.writeFile(resultPath, Buffer.from(m[2], 'base64'));

    // === 7. Mark generation done + return ===
    const { rows: balRows } = await db.query(
      `SELECT balance FROM credit_accounts WHERE id = $1`,
      [accountId!],
    );
    const balance = balRows[0]?.balance ?? 0;

    await db.query(
      `UPDATE generations SET status='done' WHERE id=$1`,
      [generationId],
    );

    res.json({
      generationId,
      imageUrl: `/api/photos/${resultName}`,
      ttlMinutes: TTL_MIN,
      balance,
      modelUsed: aiResult.modelUsed,
    });
  } catch (err: any) {
    console.error('[gen/single] unhandled:', err?.stack || err?.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { db } from '../db/pool';
import * as openrouter from '../services/openrouter';
import * as replicate from '../services/replicate';
import { buildPrompt, buildSocialPortraitShortPrompt, buildSocialPortraitMinimalPrompt } from '../services/prompts';
import { buildPairPrompt } from '../services/pairPrompts';
import { getFilteredParts, WISH_MAX_LENGTH } from '../services/wishFilter';
import { createSignedLink } from '../services/signedPhotoLink';

const TEMP_DIR = process.env.PHOTO_TEMP_DIR || '/var/www/ai-fotosessia.ru/temp-photos';
const TTL_MIN = Number(process.env.PHOTO_TTL_MINUTES ?? 30);

const router = Router();

interface SingleRequest {
  customerKey?: string;
  styleId?: string;
  sourcePhotoFilename?: string;
  customPrompt?: string;
  isFullBody?: boolean;
  genderMode?: 'female' | 'male';
  originalDimensions?: { width: number; height: number };
}

interface PairRequest {
  customerKey?: string;
  styleId?: string;
  sourcePhotoFilenameA?: string;
  sourcePhotoFilenameB?: string;
}

// ---------------------------------------------------------------------------
// refundCredit — best-effort, не падает наверх.
// amount: 1 для single, 2 для pair.
// ---------------------------------------------------------------------------
async function refundCredit(
  accountId: string,
  generationId: string,
  reason: string,
  amount = 1,
) {
  try {
    await db.query(
      `UPDATE credit_accounts SET balance = balance + $1 WHERE id = $2`,
      [amount, accountId],
    );
    await db.query(
      `INSERT INTO credit_transactions (account_id, type, amount, idempotency_key, description)
         VALUES ($1, 'refund', $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING`,
      [accountId, amount, `refund_gen_${generationId}`, reason.slice(0, 200)],
    );
    await db.query(
      `UPDATE generations SET status='error', error_message=$1 WHERE id=$2`,
      [reason.slice(0, 500), generationId],
    );
  } catch (e: any) {
    console.error('[gen] refund failed:', e?.message);
  }
}

// ---------------------------------------------------------------------------
// resolveTempFilename — проверяет существование файла в TEMP_DIR и TTL,
// НЕ читает содержимое. Возвращает безопасное имя файла или null (ответ уже
// отправлен). Вызывается ДО списания кредитов, как и раньше.
// ---------------------------------------------------------------------------
async function resolveTempFilename(
  res: any,
  filename: string,
  label: string,
): Promise<string | null> {
  const safeName = path.basename(filename);
  const srcPath = path.resolve(TEMP_DIR, safeName);
  if (!srcPath.startsWith(path.resolve(TEMP_DIR))) {
    res.status(400).json({ error: `Bad filename for ${label}` });
    return null;
  }
  try {
    const stat = await fs.stat(srcPath);
    const ageMin = (Date.now() - stat.mtimeMs) / 60_000;
    if (ageMin > TTL_MIN) {
      res.status(410).json({
        error: `Фото ${label} устарело. Загрузите заново.`,
        code: 'source_expired',
      });
      return null;
    }
    return safeName;
  } catch {
    res.status(404).json({ error: `Фото ${label} не найдено`, code: 'source_missing' });
    return null;
  }
}

// Читает файл как data URL — нужен только для Replicate (InstantID), который
// принимает исключительно base64/data URL. Путь к OpenRouter теперь идёт
// через createSignedTempImageUrl() ниже и файл вообще не читает.
async function readTempImageDataUrl(safeName: string): Promise<string> {
  const srcPath = path.join(TEMP_DIR, safeName);
  const buf = await fs.readFile(srcPath);
  const mime = safeName.endsWith('.png')  ? 'image/png'
             : safeName.endsWith('.webp') ? 'image/webp'
             : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Временная подписанная ссылка (10 мин, HMAC) вместо base64 в теле запроса
// к OpenRouter/AI Gateway — см. server/services/signedPhotoLink.ts.
// Чисто в памяти, файл не читает — можно звать сколько угодно раз без гонки
// с TTL-очисткой (реальная проверка свежести — в момент фактического fetch
// по /api/photos/signed/:token).
function createSignedTempImageUrl(safeName: string): string {
  const { token } = createSignedLink(safeName);
  const base = (process.env.APP_URL || 'https://www.ai-fotosessia.ru').replace(/\/+$/, '');
  return `${base}/api/photos/signed/${token}`;
}

// =============================================================================
// POST /api/generation/single — 1 credit, 1 reference image
// =============================================================================
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

    // === 1. Validate source photo exists (before charging credits) ===
    const safePhotoName = await resolveTempFilename(res, sourcePhotoFilename, 'A');
    if (!safePhotoName) return;

    // === 2. Resolve style prompt server-side ===
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
        `INSERT INTO generations (id, customer_key, style_id, status, custom_prompt, is_full_body, gender_mode, credits_charged)
           VALUES ($1, $2, $3, 'running', $4, $5, $6, 1)`,
        [generationId, customerKey, body.styleId ?? null, body.customPrompt ?? null, !!body.isFullBody, body.genderMode ?? 'female'],
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
    // Wish filter: log any forbidden fragments that were stripped.
    // Raw value is already saved to DB (audit trail). buildPrompt() applies
    // filterWish() internally — this log is for server-side visibility only.
    if (body.customPrompt) {
      const rawWish = body.customPrompt.slice(0, WISH_MAX_LENGTH);
      const blocked = getFilteredParts(rawWish);
      if (blocked.length > 0) {
        console.log(`[gen/single] wish-filter: stripped ${blocked.length} fragment(s) [${generationId}]:`, blocked);
      }
    }

    // === IDENTITY-PRESERVING ROUTE ===
    // social_portrait — единственный стиль, где критично точное лицо. Если задан
    // REPLICATE_API_TOKEN, гоним его через InstantID (face-embedding identity),
    // а не через Gemini (где фото = style reference и лицо «плывёт»).
    // Все остальные стили и весь fallback — прежний путь через OpenRouter/Gemini.
    const useIdentityPipeline = styleId === 'social_portrait' && replicate.isReplicateConfigured();

    let aiResult: { imageDataUrl: string; modelUsed: string };
    try {
      if (useIdentityPipeline) {
        const imageInputDataUrl = await readTempImageDataUrl(safePhotoName);
        const short = buildSocialPortraitShortPrompt(body.genderMode);
        console.log(`[gen/single] identity pipeline (InstantID) for ${generationId}`);
        aiResult = await replicate.generatePortrait({
          faceImage: imageInputDataUrl,
          prompt: short.prompt,
          negativePrompt: short.negativePrompt,
          aspectRatio: dim?.width && dim?.height ? { width: dim.width, height: dim.height } : undefined,
        });
      } else {
        // EXPERIMENT social_portrait_identity_test: при SOCIAL_PORTRAIT_MINIMAL=1
        // используем минимальный edit-промпт (~80 слов) вместо полного (~3200 слов).
        // Гипотеза: короткий промпт перестаёт глушить фото → выше сходство лица.
        const useMinimal = styleId === 'social_portrait'
          && (process.env.SOCIAL_PORTRAIT_MINIMAL || '').trim() === '1';

        // styleId передаётся в buildPrompt() как дополнительный сигнал детектирования:
        // некоторые стили (bw_portrait) могут приходить с пустым stylePrompt при bundle-fallback,
        // и styleId служит страховочным идентификатором для активации нужных блоков.
        const prompt = useMinimal
          ? buildSocialPortraitMinimalPrompt(body.genderMode)
          : buildPrompt({
              styleId,
              stylePrompt,
              customPrompt: body.customPrompt,
              isFullBody: !!body.isFullBody,
              genderMode: body.genderMode,
              aspectRatio,
            });
        if (useMinimal) console.log(`[gen/single] EXPERIMENT minimal prompt for ${generationId}`);
        aiResult = await openrouter.generateImage({
          prompt,
          imageInput: createSignedTempImageUrl(safePhotoName),
        });
      }
    } catch (e: any) {
      const reason = `${e?.code || 'ai_error'}: ${e?.message || 'unknown'}`;
      console.error(`[gen/single] generation error for ${generationId}:`, reason);
      await refundCredit(accountId!, generationId, reason, 1);

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
      await refundCredit(accountId!, generationId, reason, 1);
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

// =============================================================================
// POST /api/generation/pair — 2 credits, 2 reference images (Phase 5)
// body: { customerKey, styleId, sourcePhotoFilenameA, sourcePhotoFilenameB }
// =============================================================================
router.post('/pair', async (req, res) => {
  try {
    const body = (req.body ?? {}) as PairRequest;
    const customerKey = (body.customerKey ?? '').trim();
    const styleId = (body.styleId ?? '').trim();
    const sourcePhotoFilenameA = body.sourcePhotoFilenameA ?? '';
    const sourcePhotoFilenameB = body.sourcePhotoFilenameB ?? '';

    if (!customerKey) {
      return res.status(400).json({ error: 'customerKey required', code: 'missing_customer_key' });
    }
    if (!styleId) {
      return res.status(400).json({ error: 'styleId required', code: 'missing_style_id' });
    }
    if (!sourcePhotoFilenameA) {
      return res.status(400).json({ error: 'sourcePhotoFilenameA required', code: 'missing_source_a' });
    }
    if (!sourcePhotoFilenameB) {
      return res.status(400).json({ error: 'sourcePhotoFilenameB required', code: 'missing_source_b' });
    }

    // === 1. Validate both source photos exist (TTL check, before charging credits) ===
    const safePhotoNameA = await resolveTempFilename(res, sourcePhotoFilenameA, 'A');
    if (!safePhotoNameA) return;

    const safePhotoNameB = await resolveTempFilename(res, sourcePhotoFilenameB, 'B');
    if (!safePhotoNameB) return;

    // === 2. Resolve style prompt server-side ===
    const { rows: styleRows } = await db.query(
      `SELECT prompt FROM styles WHERE id = $1 AND active = true LIMIT 1`,
      [styleId],
    );
    if (!styleRows[0]) {
      return res.status(400).json({ error: 'Style not found', code: 'invalid_style_id' });
    }
    const stylePrompt = styleRows[0].prompt as string;

    // === 3. Atomic debit of 2 credits + create generation row ===
    const PAIR_CREDITS = 2;
    const generationId = crypto.randomUUID();
    const debitKey = `debit_pair_${generationId}`;
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
      if (account.balance < PAIR_CREDITS) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: `Для парного фото нужно минимум ${PAIR_CREDITS} генерации. Купите пакет, чтобы продолжить.`,
          balance: account.balance,
          code: 'insufficient_balance',
        });
      }
      accountId = account.id;

      await client.query(
        `UPDATE credit_accounts SET balance = balance - $1 WHERE id = $2`,
        [PAIR_CREDITS, account.id],
      );
      await client.query(
        `INSERT INTO credit_transactions (account_id, type, amount, idempotency_key, description)
           VALUES ($1, 'debit', $2, $3, $4)`,
        [account.id, PAIR_CREDITS, debitKey, `Pair generation ${generationId}`],
      );
      await client.query(
        `INSERT INTO generations
           (id, customer_key, style_id, status, is_full_body, gender_mode,
            source_photo_b, credits_charged)
           VALUES ($1, $2, $3, 'running', false, 'female', $4, $5)`,
        [generationId, customerKey, styleId, safePhotoNameB, PAIR_CREDITS],
      );

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error('[gen/pair] debit tx failed:', e?.message);
      return res.status(500).json({ error: 'Internal error during credit debit' });
    }
    client.release();

    // === 4. Build pair prompt + call OpenRouter with 2 images ===
    const prompt = buildPairPrompt({ stylePrompt });

    let aiResult: openrouter.GenerateImageResult;
    try {
      aiResult = await openrouter.generatePairImage({
        prompt,
        imageInputA: createSignedTempImageUrl(safePhotoNameA),
        imageInputB: createSignedTempImageUrl(safePhotoNameB),
      });
    } catch (e: any) {
      const reason = `${e?.code || 'ai_error'}: ${e?.message || 'unknown'}`;
      console.error(`[gen/pair] OpenRouter error for ${generationId}:`, reason);
      await refundCredit(accountId!, generationId, reason, PAIR_CREDITS);

      const status = e?.status >= 400 && e?.status < 600 ? e.status : 502;
      const userMsg = e?.code === 'no_api_key'
        ? 'Сервис генерации временно недоступен. 2 кредита возвращены.'
        : e?.code === 'timeout'
          ? 'Генерация заняла слишком долго. 2 кредита возвращены, попробуйте ещё раз.'
          : 'Ошибка генерации. 2 кредита возвращены, попробуйте ещё раз.';

      const { rows: balRows } = await db.query(
        `SELECT balance FROM credit_accounts WHERE id = $1`,
        [accountId!],
      );

      return res.status(status).json({
        error: userMsg,
        code: e?.code,
        refunded: true,
        refundedAmount: PAIR_CREDITS,
        balance: balRows[0]?.balance ?? 0,
      });
    }

    // === 5. Save result image to temp dir ===
    const m = aiResult.imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) {
      const reason = 'ai_returned_non_image';
      console.error(`[gen/pair] ${reason}`);
      await refundCredit(accountId!, generationId, reason, PAIR_CREDITS);
      const { rows: balRows } = await db.query(
        `SELECT balance FROM credit_accounts WHERE id = $1`,
        [accountId!],
      );
      return res.status(502).json({
        error: 'AI вернул некорректный ответ. 2 кредита возвращены.',
        refunded: true,
        refundedAmount: PAIR_CREDITS,
        balance: balRows[0]?.balance ?? 0,
      });
    }

    const ext = m[1] === 'png' ? '.png' : '.jpg';
    const resultName = `gen_${generationId}${ext}`;
    const resultPath = path.join(TEMP_DIR, resultName);
    await fs.writeFile(resultPath, Buffer.from(m[2], 'base64'));

    // === 6. Mark generation done + return ===
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
    console.error('[gen/pair] unhandled:', err?.stack || err?.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;

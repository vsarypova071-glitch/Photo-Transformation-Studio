import crypto from 'crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { db as defaultDb } from '../db/pool';
import {
  createPayment as ykCreatePayment,
  getPayment as ykGetPayment,
  diagnoseCredentials as ykDiagnose,
} from '../services/yookassa';
import { flags } from '../featureFlags';
import { isValidReferralCode } from '../services/referrals';
import { creditOrderOnce } from '../services/orderCredit';

const TARIFFS = {
  basic:    { price: 479,  photosCount: 5  },
  standard: { price: 1299, photosCount: 15 },
  premium:  { price: 2999, photosCount: 50 },
} as const;
type TariffId = keyof typeof TARIFFS;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// === Webhook auth middleware ===
// YooKassa supports webhook URLs with embedded creds (https://user:pass@host/path).
// We fail-closed when env is missing so a misconfiguration can never silently
// accept unauthenticated callbacks.
export function makeWebhookAuth(envProvider: () => { user: string; pass: string } = readWebhookEnv) {
  return function webhookAuth(req: Request, res: Response, next: NextFunction) {
    const { user, pass } = envProvider();
    if (!user || !pass) {
      console.error('[webhook] CONFIG ERROR: YOOKASSA_WEBHOOK_USER/PASS not set — fail-closed');
      res.status(503).json({ error: 'Webhook auth not configured' });
      return;
    }

    const header = (req.headers.authorization || '').toString();
    const m = /^Basic\s+(.+)$/i.exec(header);
    if (!m) {
      res.setHeader('WWW-Authenticate', 'Basic realm="yookassa-webhook"');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let decoded = '';
    try {
      decoded = Buffer.from(m[1], 'base64').toString('utf-8');
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idx = decoded.indexOf(':');
    if (idx === -1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const gotUser = decoded.slice(0, idx);
    const gotPass = decoded.slice(idx + 1);

    if (!timingSafeStrEq(gotUser, user) || !timingSafeStrEq(gotPass, pass)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}

function readWebhookEnv(): { user: string; pass: string } {
  return {
    user: (process.env.YOOKASSA_WEBHOOK_USER || '').trim(),
    pass: process.env.YOOKASSA_WEBHOOK_PASS || '',
  };
}

function timingSafeStrEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// === Router factory: allows tests to inject mocked db + yookassa client ===
export interface PaymentRouterDeps {
  db?: typeof defaultDb;
  createPayment?: typeof ykCreatePayment;
  getPayment?: typeof ykGetPayment;
  diagnoseCredentials?: typeof ykDiagnose;
  webhookEnv?: () => { user: string; pass: string };
}

export function createPaymentRouter(deps: PaymentRouterDeps = {}) {
  const db = deps.db ?? defaultDb;
  const createPayment = deps.createPayment ?? ykCreatePayment;
  const getPayment = deps.getPayment ?? ykGetPayment;
  const diagnoseCredentials = deps.diagnoseCredentials ?? ykDiagnose;
  const webhookAuth = makeWebhookAuth(deps.webhookEnv ?? readWebhookEnv);

  const router = Router();

  // === Диагностика ЮKassa — только для DevOps. Закрыта токеном. ===
  // Установить DIAGNOSTIC_TOKEN=<random> в server/.env.
  // Запрос: GET /api/payment/diagnostic?token=<значение>
  // Без токена → 404 (не раскрываем факт существования endpoint'а).
  router.get('/diagnostic', async (req, res) => {
    const token = (process.env.DIAGNOSTIC_TOKEN || '').trim();
    if (!token || req.query.token !== token) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(await diagnoseCredentials());
  });

  router.post('/create', async (req, res) => {
    try {
      const {
        tariffId,
        userSessionId,
        customerKey,
        customerEmail,
        styleIds,
        originalImageUrl,
        customPrompt,
        isFullBody,
        referralCode,
      } = req.body ?? {};

      console.log('[payment/create] REQUEST', { tariffId, customerKey: customerKey?.slice(0,20), customerEmail });

      if (!userSessionId) return res.status(400).json({ error: 'Missing userSessionId' });
      const tariff = TARIFFS[tariffId as TariffId];
      if (!tariff) return res.status(400).json({ error: 'Invalid tariff' });

      const email = typeof customerEmail === 'string' ? customerEmail.trim() : '';
      if (!email || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Укажите корректный email для получения чека об оплате' });
      }

      const safeStyleIds: string[] = Array.isArray(styleIds)
        ? styleIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
      const safeOriginalImage = typeof originalImageUrl === 'string' && originalImageUrl.trim() ? originalImageUrl : null;
      const safeCustomPrompt = typeof customPrompt === 'string' && customPrompt.trim() ? customPrompt.trim() : null;
      const safeIsFullBody = Boolean(isFullBody);
      const safeCustomerKey = typeof customerKey === 'string' && customerKey.trim() ? customerKey.trim() : null;

      // Реферальный код принимаем, только если фича включена И код имеет валидный формат.
      // Self-referral отсеиваем здесь же — сравниваем код с кодом самого юзера.
      let safeReferralCode: string | null = null;
      if (flags.enableReferrals && typeof referralCode === 'string') {
        const candidate = referralCode.trim().toUpperCase();
        if (isValidReferralCode(candidate) && safeCustomerKey) {
          const { rows: selfCheck } = await db.query(
            `SELECT 1 FROM credit_accounts WHERE customer_key = $1 AND referral_code = $2`,
            [safeCustomerKey, candidate],
          );
          if (selfCheck.length === 0) {
            safeReferralCode = candidate;
          }
          // self-referral: code просто игнорируется, payment продолжается
        }
      }

      // === BALANCE GUARD: если на кошельке есть кредиты — запрещаем новую покупку ===
      // Бизнес-правило: balance > 0 ⇒ юзер сначала тратит существующие генерации.
      if (safeCustomerKey) {
        const { rows: bRows } = await db.query(
          `SELECT balance FROM credit_accounts WHERE customer_key = $1`,
          [safeCustomerKey],
        );
        const currentBalance = bRows[0]?.balance ?? 0;
        console.log('[payment/create] BALANCE GUARD', { safeCustomerKey: safeCustomerKey.slice(0,20), currentBalance, blocked: currentBalance > 0 });
        if (currentBalance > 0) {
          return res.status(409).json({
            error: 'У вас уже есть активный пакет. Сначала используйте оставшиеся генерации.',
            balance: currentBalance,
            code: 'balance_not_empty',
          });
        }
      }

      // === SAFEGUARD: уже есть оплаченный заказ за 24ч — возвращаем его, не списываем повторно ===
      if (safeCustomerKey) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const { rows: paidRows } = await db.query(
          `SELECT id, payment_status, generation_status, results, photos_count, tariff_id, created_at, credits_purchased
             FROM orders
            WHERE customer_key = $1
              AND payment_status = 'succeeded'
              AND generation_status IN ('waiting','running','error','done','credits_credited')
              AND created_at >= $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [safeCustomerKey, since.toISOString()],
        );
        const existing = paidRows[0];
        console.log('[payment/create] SAFEGUARD', {
          found: !!existing,
          id: existing?.id,
          generation_status: existing?.generation_status,
          credits_purchased: existing?.credits_purchased,
        });
        if (existing) {
          // credits_credited + balance=0 (guard passed above) = credits were spent.
          // Do NOT reuse — allow the user to make a new purchase.
          if (existing.generation_status !== 'credits_credited') {
            const hasResults = Array.isArray(existing.results) && existing.results.length > 0;
            const shouldReuse = existing.generation_status !== 'done' || hasResults;
            console.log('[payment/create] SAFEGUARD decision', { hasResults, shouldReuse, action: shouldReuse ? 'REUSE' : 'CREATE_NEW' });
            if (shouldReuse) {
              return res.json({
                existingOrder: true,
                orderId: existing.id,
                generationStatus: existing.generation_status,
                paymentStatus: existing.payment_status,
                photosCount: existing.photos_count,
                results: existing.results || [],
                message: 'У вас уже есть оплаченный заказ.',
              });
            }
          } else {
            console.log('[payment/create] SAFEGUARD skip: credits_credited + balance=0 → allow new purchase');
          }
        }

        // === DUPLICATE GUARD: pending заказ < 10 минут с теми же параметрами — переиспользуем ===
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        const { rows: pendingRows } = await db.query(
          `SELECT id, payment_id, tariff_id, price, photos_count, style_ids, original_image, custom_prompt, is_full_body
             FROM orders
            WHERE customer_key = $1
              AND payment_status = 'pending'
              AND created_at >= $2
              AND payment_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 5`,
          [safeCustomerKey, tenMinAgo.toISOString()],
        );

        const dup = pendingRows.find((r) =>
          r.tariff_id === tariffId &&
          r.price === tariff.price &&
          r.photos_count === tariff.photosCount &&
          arraysEqual(r.style_ids ?? [], safeStyleIds) &&
          (r.original_image ?? null) === safeOriginalImage &&
          (r.custom_prompt ?? null) === safeCustomPrompt &&
          Boolean(r.is_full_body) === safeIsFullBody,
        );

        console.log('[payment/create] DUPLICATE GUARD', { pendingCount: pendingRows.length, dupFound: !!dup });
        if (dup?.payment_id) {
          const yoo = await getPayment(dup.payment_id);
          console.log('[payment/create] DUPLICATE yoo status', { status: yoo?.status, hasUrl: !!yoo?.confirmation?.confirmation_url });
          if (yoo && yoo.status === 'pending' && yoo.confirmation?.confirmation_url) {
            return res.json({
              orderId: dup.id,
              paymentId: dup.payment_id,
              paymentUrl: yoo.confirmation.confirmation_url,
              reused: true,
            });
          }
        }
      }

      // === CREATE ORDER ===
      const { rows } = await db.query(
        `INSERT INTO orders
           (user_session_id, customer_key, tariff_id, photos_count, price,
            style_ids, original_image, custom_prompt, is_full_body,
            payment_status, generation_status, referral_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','waiting',$10)
         RETURNING id`,
        [
          userSessionId,
          safeCustomerKey,
          tariffId,
          tariff.photosCount,
          tariff.price,
          safeStyleIds,
          safeOriginalImage,
          safeCustomPrompt,
          safeIsFullBody,
          safeReferralCode,
        ],
      );
      const orderId: string = rows[0].id;

      const origin = (req.headers.origin as string | undefined) || process.env.APP_URL || 'https://ai-fotosessia.ru';
      const returnUrl = `${origin}?order_id=${orderId}`;

      // Сохраняем email в credit_accounts (для будущей коммуникации) — best-effort
      if (safeCustomerKey) {
        try {
          await db.query(
            `INSERT INTO credit_accounts (customer_key, email)
               VALUES ($1, $2)
               ON CONFLICT (customer_key) DO UPDATE SET email = COALESCE(credit_accounts.email, EXCLUDED.email)`,
            [safeCustomerKey, email],
          );
        } catch (e) {
          console.warn('[payment/create] credit_accounts upsert failed', (e as Error).message);
        }
      }

      let payment;
      try {
        payment = await createPayment({
          orderId,
          tariffId,
          photosCount: tariff.photosCount,
          price: tariff.price,
          email,
          returnUrl,
          customerKey: safeCustomerKey,
        });
      } catch (e: any) {
        // Откатываем заказ, если ЮKassa не приняла платёж — иначе будет фантомный pending
        await db.query(`DELETE FROM orders WHERE id = $1 AND payment_status = 'pending'`, [orderId]);
        const code = e?.yooCode;
        if (code === 'invalid_credentials') {
          return res.status(500).json({
            error: 'Платёжный сервис временно недоступен. Мы уже разбираемся, попробуйте через несколько минут.',
            debug: process.env.NODE_ENV === 'production' ? undefined : 'YooKassa: invalid_credentials — check YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY',
          });
        }
        return res.status(500).json({ error: e?.message || 'Не удалось создать платёж' });
      }

      await db.query('UPDATE orders SET payment_id = $1 WHERE id = $2', [payment.id, orderId]);

      console.log('[payment/create] PAYMENT CREATED', { orderId, paymentId: payment.id, confirmationUrl: payment.confirmation?.confirmation_url?.slice(0, 60) });

      if (!payment.confirmation?.confirmation_url) {
        return res.status(500).json({ error: 'YooKassa did not return confirmation_url', paymentId: payment.id });
      }

      return res.json({
        orderId,
        paymentId: payment.id,
        paymentUrl: payment.confirmation.confirmation_url,
      });
    } catch (err: any) {
      console.error('[payment/create]', err?.message || err);
      res.status(500).json({ error: err?.message || 'Internal error' });
    }
  });

  // === WEBHOOK: YooKassa → нам. ===
  // Layered defense:
  //   1. HTTP Basic Auth (YooKassa sends Authorization header from URL creds)
  //   2. Cross-check body.payment.id == orders.payment_id (no order crosswire)
  //   3. Re-verify status via getPayment() — body alone never moves credits
  // Idempotency: credits_purchased>0 check + idempotency_key on credit_transactions.
  // YooKassa sometimes sends requests with a trailing dot (/webhook.)
  router.post(['/webhook', '/webhook.'], webhookAuth, async (req, res) => {
    // YooKassa ожидает 200 в течение 30 сек — отвечаем максимально быстро. Долгая работа — после respond.
    res.status(200).send('OK');

    try {
      const body = req.body ?? {};
      const event = body?.event;
      const payment = body?.object;
      const paymentId: string | undefined = payment?.id;
      const orderIdMeta: string | undefined = payment?.metadata?.order_id;

      // Никогда не логируем тело целиком и заголовки — только IDs.
      console.log(`[webhook] event=${event} payment=${paymentId} order=${orderIdMeta}`);

      if (!paymentId || !orderIdMeta) return;

      // === Defense layer 3: re-verify with YooKassa BEFORE any DB write ===
      // Body alone is attacker-controllable; YooKassa's authoritative status is not.
      const verified = await getPayment(paymentId);
      if (!verified) {
        console.warn(`[webhook] payment ${paymentId} not found in YooKassa — rejected`);
        return;
      }
      const verifiedStatus = verified.status;

      if (verifiedStatus === 'canceled') {
        // Cross-check payment_id stored on the order before mutating
        await db.query(
          `UPDATE orders SET payment_status = 'canceled'
             WHERE id = $1 AND payment_id = $2 AND payment_status <> 'succeeded'`,
          [orderIdMeta, paymentId],
        );
        return;
      }

      if (verifiedStatus !== 'succeeded') {
        console.log(`[webhook] payment ${paymentId} status=${verifiedStatus} (not succeeded) — ignored`);
        return;
      }

      try {
        const result = await creditOrderOnce(db, orderIdMeta, paymentId);
        switch (result.status) {
          case 'credited':
            console.log(`[webhook] order ${orderIdMeta}: credited ${result.photos}`);
            break;
          case 'already':
            console.log(`[webhook] order ${orderIdMeta} already credited (${result.photos})`);
            break;
          case 'no_order':
            console.warn(`[webhook] no order matches id=${orderIdMeta} payment_id=${paymentId}`);
            break;
          case 'invalid_order':
            console.error(`[webhook] order ${orderIdMeta} missing customer_key or photos`);
            break;
        }
      } catch (e) {
        console.error('[webhook] credit tx failed', (e as Error).message);
      }
    } catch (err: any) {
      console.error('[webhook] handler error', err?.message || err);
    }
  });

  return router;
}

export default createPaymentRouter();

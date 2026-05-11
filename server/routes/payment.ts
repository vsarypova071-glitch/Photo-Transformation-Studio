import { Router } from 'express';
import { db } from '../db/pool';
import { createPayment, getPayment, diagnoseCredentials } from '../services/yookassa';
import { flags } from '../featureFlags';
import { grantIfApplicable, isValidReferralCode } from '../services/referrals';

const router = Router();

// === Безопасная диагностика. НЕ показывает секрет, только метаданные. ===
router.get('/diagnostic', async (_req, res) => {
  res.json(await diagnoseCredentials());
});

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
      if (existing) {
        const hasResults = Array.isArray(existing.results) && existing.results.length > 0;
        const isCreditsTopup = existing.generation_status === 'credits_credited' || (existing.credits_purchased ?? 0) > 0;
        const shouldReuse = isCreditsTopup || existing.generation_status !== 'done' || hasResults;
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

      if (dup?.payment_id) {
        const yoo = await getPayment(dup.payment_id);
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

// === WEBHOOK: YooKassa → нам. Идемпотентность через credits_purchased и idempotency_key. ===
router.post('/webhook', async (req, res) => {
  // YooKassa ожидает 200 в течение 30 сек — отвечаем максимально быстро. Долгая работа — после respond.
  res.status(200).send('OK');

  try {
    const body = req.body ?? {};
    const event = body?.event;
    const payment = body?.object;
    const paymentId: string | undefined = payment?.id;
    const status: string | undefined = payment?.status;
    const orderIdMeta: string | undefined = payment?.metadata?.order_id;

    console.log(`[webhook] event=${event} payment=${paymentId} status=${status} order=${orderIdMeta}`);

    if (!paymentId || !orderIdMeta) return;

    if (status === 'canceled') {
      await db.query(`UPDATE orders SET payment_status = 'canceled' WHERE id = $1`, [orderIdMeta]);
      return;
    }

    if (status !== 'succeeded' && event !== 'payment.succeeded') return;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows: orderRows } = await client.query(
        `SELECT id, customer_key, photos_count, tariff_id, credits_purchased,
                payment_status, generation_status, referral_code
           FROM orders WHERE id = $1 FOR UPDATE`,
        [orderIdMeta],
      );
      const order = orderRows[0];
      if (!order) {
        console.warn(`[webhook] order ${orderIdMeta} not found`);
        await client.query('COMMIT');
        return;
      }

      // Идемпотентность: повторный webhook не делает ничего
      if ((order.credits_purchased ?? 0) > 0) {
        console.log(`[webhook] order ${orderIdMeta} already credited (${order.credits_purchased})`);
        await client.query('COMMIT');
        return;
      }

      const customerKey: string = (order.customer_key || '').trim();
      const photos: number = Number(order.photos_count || 0);

      if (!customerKey || photos <= 0) {
        await client.query(
          `UPDATE orders
              SET payment_status = 'succeeded',
                  generation_status = 'error'
            WHERE id = $1`,
          [orderIdMeta],
        );
        await client.query('COMMIT');
        console.error(`[webhook] order ${orderIdMeta} missing customer_key or photos`);
        return;
      }

      // upsert credit_accounts
      const { rows: accRows } = await client.query(
        `INSERT INTO credit_accounts (customer_key) VALUES ($1)
           ON CONFLICT (customer_key) DO UPDATE SET updated_at = now()
           RETURNING id`,
        [customerKey],
      );
      const accountId = accRows[0].id;

      const idemKey = `topup_order_${orderIdMeta}`;
      const { rows: txInsert } = await client.query(
        `INSERT INTO credit_transactions
           (account_id, order_id, type, amount, idempotency_key, description)
         VALUES ($1,$2,'credit',$3,$4,$5)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [accountId, orderIdMeta, photos, idemKey, `Пополнение за заказ ${order.tariff_id} (${photos} фото)`],
      );

      // Если транзакция действительно вставилась (а не была заблокирована ON CONFLICT) — обновляем баланс
      if (txInsert.length > 0) {
        await client.query(
          `UPDATE credit_accounts SET balance = balance + $1 WHERE id = $2`,
          [photos, accountId],
        );
      }

      await client.query(
        `UPDATE orders
            SET payment_status = 'succeeded',
                generation_status = 'credits_credited',
                credits_purchased = $1
          WHERE id = $2`,
        [photos, orderIdMeta],
      );

      await client.query('COMMIT');
      console.log(`[webhook] order ${orderIdMeta}: credited ${photos} to ${customerKey}`);

      // === REFERRAL BONUS (после COMMIT основной транзакции) ===
      // Отдельная транзакция внутри grantIfApplicable. Если упадёт — не ломаем
      // оплату, лог-предупреждение и идём дальше. Идемпотентность по
      // idempotency_key='ref_bonus_<order_id>'.
      if (flags.enableReferrals && order.referral_code) {
        try {
          const ref = await grantIfApplicable({
            orderId: orderIdMeta,
            refereeKey: customerKey,
            referralCode: order.referral_code,
          });
          console.log(`[webhook] order ${orderIdMeta}: referral status=${ref.status}` +
            (ref.referrerKey ? ` referrer=${ref.referrerKey}` : ''));
        } catch (refErr) {
          console.warn(`[webhook] order ${orderIdMeta}: referral grant failed`,
            (refErr as Error).message);
        }
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[webhook] tx failed', (e as Error).message);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[webhook] handler error', err?.message || err);
  }
});

export default router;

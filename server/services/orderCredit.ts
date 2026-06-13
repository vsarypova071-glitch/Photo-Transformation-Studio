// Единая точка начисления кредитов за оплаченный заказ.
//
// Зачем: раньше начисление жило ТОЛЬКО в webhook-обработчике. Доставка вебхука
// YooKassa ненадёжна (может не дойти вовсе) — тогда оплата проходит, но кредиты
// не начисляются, и заказ по таймауту падает в generation_status='error'.
//
// Теперь и webhook, и polling-роут (/order/check) вызывают эту функцию.
// Идемпотентность гарантируется на двух уровнях:
//   1. guard credits_purchased > 0 (повторный вызов — no-op);
//   2. ON CONFLICT (idempotency_key) DO NOTHING на credit_transactions.
// Поэтому функцию безопасно вызывать многократно и из разных мест одновременно
// (FOR UPDATE сериализует конкурентные вызовы по одному заказу).
//
// ВАЖНО: вызывающий обязан заранее убедиться, что платёж действительно succeeded
// (через authoritative getPayment у YooKassa) — функция деньги не проверяет.

import { flags } from '../featureFlags';
import { grantIfApplicable } from './referrals';

export type CreditOrderStatus =
  | 'credited'      // кредиты начислены этим вызовом
  | 'already'       // уже были начислены ранее
  | 'no_order'      // нет заказа с такой парой id+payment_id (или crosswire)
  | 'invalid_order'; // заказ без customer_key / photos — помечен error

export interface CreditOrderResult {
  status: CreditOrderStatus;
  photos?: number;
}

// Минимальный контракт пула, чтобы подходил и pg.Pool, и мок из тестов.
interface DbLike {
  connect: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
    release: () => void;
  }>;
}

export async function creditOrderOnce(
  db: DbLike,
  orderId: string,
  paymentId: string,
): Promise<CreditOrderResult> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Defense layer 2: cross-check payment_id привязан к этому заказу.
    const { rows: orderRows } = await client.query(
      `SELECT id, customer_key, photos_count, tariff_id, credits_purchased, referral_code
         FROM orders
        WHERE id = $1 AND payment_id = $2
        FOR UPDATE`,
      [orderId, paymentId],
    );
    const order = orderRows[0];
    if (!order) {
      await client.query('COMMIT');
      return { status: 'no_order' };
    }

    // Идемпотентность: повторный вызов ничего не делает.
    if ((order.credits_purchased ?? 0) > 0) {
      await client.query('COMMIT');
      return { status: 'already', photos: order.credits_purchased };
    }

    const customerKey: string = (order.customer_key || '').trim();
    const photos: number = Number(order.photos_count || 0);

    if (!customerKey || photos <= 0) {
      await client.query(
        `UPDATE orders SET payment_status = 'succeeded', generation_status = 'error' WHERE id = $1`,
        [orderId],
      );
      await client.query('COMMIT');
      return { status: 'invalid_order' };
    }

    const { rows: accRows } = await client.query(
      `INSERT INTO credit_accounts (customer_key) VALUES ($1)
         ON CONFLICT (customer_key) DO UPDATE SET updated_at = now()
         RETURNING id`,
      [customerKey],
    );
    const accountId = accRows[0].id;

    const idemKey = `topup_order_${orderId}`;
    const { rows: txInsert } = await client.query(
      `INSERT INTO credit_transactions
         (account_id, order_id, type, amount, idempotency_key, description)
       VALUES ($1,$2,'credit',$3,$4,$5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [accountId, orderId, photos, idemKey, `Пополнение за заказ ${order.tariff_id} (${photos} фото)`],
    );

    // Баланс двигаем только если транзакция реально вставилась.
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
      [photos, orderId],
    );

    await client.query('COMMIT');

    // Реферальный бонус — после основного COMMIT, не ломает оплату при ошибке.
    if (flags.enableReferrals && order.referral_code) {
      try {
        await grantIfApplicable({
          orderId,
          refereeKey: customerKey,
          referralCode: order.referral_code,
        });
      } catch (refErr) {
        console.warn(`[orderCredit] order ${orderId}: referral grant failed`, (refErr as Error).message);
      }
    }

    return { status: 'credited', photos };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

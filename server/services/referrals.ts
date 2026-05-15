// Referral system business logic. Активен только за ENABLE_REFERRALS=true.
//
// Архитектурные решения (зафиксированы в ТЗ):
//  - referral_code: 6 chars upper alphanumeric, без 0/O/1/I (read-friendly).
//  - Lazy-генерация при первом GET /api/referrals/me.
//  - В YooKassa metadata НЕ записываем — храним в orders.referral_code.
//  - Если referrer не найден → INSERT row со status='rejected' (audit trail).
//  - Reward только для referrer'а (+1 credit). referee пока ничего.
//  - Self-referral запрещён.
//  - referee_key UNIQUE → один человек может быть рефералом только один раз.
//  - Идемпотентность через credit_transactions.idempotency_key='ref_bonus_<order_id>'.

import { db } from '../db/pool';
import type { PoolClient } from 'pg';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без 0,O,1,I
const CODE_LEN = 6;
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

const REFERRER_BONUS_CREDITS = 1;

export class ReferralValidationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ReferralValidationError';
    this.code = code;
  }
}

export function isValidReferralCode(s: unknown): s is string {
  return typeof s === 'string' && CODE_RE.test(s);
}

function randomCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

// =============================================================================
// GET /api/referrals/me — lazy create code, count granted bonuses
// =============================================================================
export interface MyReferralInfo {
  referralCode: string;
  grantedCount: number;
  bonusCreditsTotal: number;
}

export async function getOrCreateMyCode(customerKey: string): Promise<MyReferralInfo> {
  const ck = customerKey.trim();
  if (!ck) throw new ReferralValidationError('customerKey required', 'missing_customer_key');

  // Гарантируем существование credit_account для этого юзера.
  await db.query(
    `INSERT INTO credit_accounts (customer_key) VALUES ($1)
       ON CONFLICT (customer_key) DO NOTHING`,
    [ck],
  );

  // Lazy-генерация: если кода нет — генерим до тех пор, пока не вставится без UNIQUE-конфликта.
  const { rows: existRows } = await db.query(
    `SELECT referral_code FROM credit_accounts WHERE customer_key = $1`,
    [ck],
  );
  let code = existRows[0]?.referral_code as string | null;

  if (!code) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomCode();
      const { rows: upd } = await db.query(
        `UPDATE credit_accounts SET referral_code = $1
           WHERE customer_key = $2 AND referral_code IS NULL
           RETURNING referral_code`,
        [candidate, ck],
      );
      if (upd.length > 0) {
        code = candidate;
        break;
      }
      // если updated 0 строк — значит код уже был установлен (race) — перечитываем
      const { rows: check } = await db.query(
        `SELECT referral_code FROM credit_accounts WHERE customer_key = $1`,
        [ck],
      );
      if (check[0]?.referral_code) {
        code = check[0].referral_code;
        break;
      }
      // иначе UNIQUE-конфликт на candidate с другим юзером — пробуем ещё раз
    }
    if (!code) {
      throw new ReferralValidationError('failed to generate unique referral_code', 'code_generation_failed');
    }
  }

  // Считаем granted referrals для этого юзера (как реферера)
  const { rows: stats } = await db.query(
    `SELECT count(*) AS granted_count, COALESCE(SUM(bonus_credits), 0) AS bonus_total
       FROM referrals
      WHERE referrer_key = $1 AND status = 'granted'`,
    [ck],
  );

  return {
    referralCode: code,
    grantedCount: Number(stats[0]?.granted_count ?? 0),
    bonusCreditsTotal: Number(stats[0]?.bonus_total ?? 0),
  };
}

// =============================================================================
// POST /api/referrals/track — pending row при заходе по ссылке
// =============================================================================
export interface TrackResult {
  ok: boolean;
  status: 'pending' | 'already' | 'self_referral' | 'invalid_code' | 'unknown_code';
}

export async function trackPending(referralCode: string, refereeKey: string): Promise<TrackResult> {
  if (!isValidReferralCode(referralCode)) {
    return { ok: false, status: 'invalid_code' };
  }
  const rk = refereeKey.trim();
  if (!rk) return { ok: false, status: 'invalid_code' };

  // Найдём referrer по коду
  const { rows: refRows } = await db.query(
    `SELECT customer_key FROM credit_accounts WHERE referral_code = $1`,
    [referralCode],
  );
  const referrerKey = refRows[0]?.customer_key as string | undefined;
  if (!referrerKey) return { ok: false, status: 'unknown_code' };

  // Self-referral?
  if (referrerKey === rk) return { ok: false, status: 'self_referral' };

  // Уже есть запись для этого referee_key?
  const { rows: ex } = await db.query(
    `SELECT id, status FROM referrals WHERE referee_key = $1`,
    [rk],
  );
  if (ex.length > 0) {
    return { ok: false, status: 'already' };
  }

  // INSERT pending. Если параллельно вставится другая строка — UNIQUE-конфликт,
  // обрабатываем как "already".
  try {
    await db.query(
      `INSERT INTO referrals (referrer_key, referee_key, referral_code, bonus_credits, status)
         VALUES ($1, $2, $3, 0, 'pending')`,
      [referrerKey, rk, referralCode],
    );
    return { ok: true, status: 'pending' };
  } catch (e: any) {
    if (e?.code === '23505') return { ok: false, status: 'already' };
    throw e;
  }
}

// =============================================================================
// grantIfApplicable — вызывается из webhook payment.succeeded
// =============================================================================
// Поведение:
//  - referral_code пустой / отсутствует → no-op (return null).
//  - referrer не найден по коду → INSERT row со status='rejected' (audit), return.
//  - self-referral → INSERT row со status='rejected', return.
//  - дубль (UNIQUE referee_key) → no double bonus, return existing.
//  - всё ок → атомарно (одна транзакция):
//      INSERT referrals (status='granted', bonus_credits=1, order_id, ...)
//      INSERT credit_transactions (type='referral_bonus', amount=1,
//             idempotency_key='ref_bonus_<order_id>')
//      UPDATE balance += 1 для referrer'а
//
// Эта функция НЕ должна бросать ошибку наверх — webhook всегда должен ответить
// 200 ЮKassa, даже если реферал упал.
// =============================================================================
export interface GrantInput {
  orderId: string;
  refereeKey: string;
  referralCode: string | null | undefined;
}
export interface GrantResult {
  status: 'no_code' | 'rejected_unknown_code' | 'rejected_self' | 'duplicate' | 'granted';
  referrerKey?: string;
  bonusCreditsAdded?: number;
}

export async function grantIfApplicable(input: GrantInput): Promise<GrantResult> {
  const { orderId, refereeKey } = input;
  const referralCode = (input.referralCode || '').trim();

  if (!referralCode || !isValidReferralCode(referralCode)) {
    return { status: 'no_code' };
  }

  const client: PoolClient = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Найдём referrer
    const { rows: refRows } = await client.query(
      `SELECT id, customer_key FROM credit_accounts WHERE referral_code = $1 FOR UPDATE`,
      [referralCode],
    );
    const referrer = refRows[0] as { id: string; customer_key: string } | undefined;

    if (!referrer) {
      // Audit-row со status='rejected'
      await client.query(
        `INSERT INTO referrals (referrer_key, referee_key, referral_code, order_id, bonus_credits, status)
           VALUES ('', $1, $2, $3, 0, 'rejected')
           ON CONFLICT (referee_key) DO NOTHING`,
        [refereeKey, referralCode, orderId],
      );
      await client.query('COMMIT');
      return { status: 'rejected_unknown_code' };
    }

    // 2. Self-referral
    if (referrer.customer_key === refereeKey) {
      await client.query(
        `INSERT INTO referrals (referrer_key, referee_key, referral_code, order_id, bonus_credits, status)
           VALUES ($1, $2, $3, $4, 0, 'rejected')
           ON CONFLICT (referee_key) DO NOTHING`,
        [referrer.customer_key, refereeKey, referralCode, orderId],
      );
      await client.query('COMMIT');
      return { status: 'rejected_self', referrerKey: referrer.customer_key };
    }

    // 3. Попробуем INSERT granted. Если уже была pending row от /track —
    //    UPDATE её на granted. Если уже granted → duplicate.
    const { rows: existing } = await client.query(
      `SELECT id, status, order_id FROM referrals WHERE referee_key = $1 FOR UPDATE`,
      [refereeKey],
    );
    if (existing.length > 0) {
      const ex = existing[0] as { id: string; status: string; order_id: string | null };
      if (ex.status === 'granted') {
        // Уже начислено
        await client.query('COMMIT');
        return { status: 'duplicate', referrerKey: referrer.customer_key };
      }
      // pending → апгрейдим до granted с этим order_id
      await client.query(
        `UPDATE referrals
            SET status = 'granted', bonus_credits = $1, order_id = $2,
                redeemed_at = now()
          WHERE id = $3`,
        [REFERRER_BONUS_CREDITS, orderId, ex.id],
      );
    } else {
      // Нет pending — INSERT сразу granted
      await client.query(
        `INSERT INTO referrals (referrer_key, referee_key, referral_code, order_id,
                                bonus_credits, status, redeemed_at)
           VALUES ($1, $2, $3, $4, $5, 'granted', now())`,
        [referrer.customer_key, refereeKey, referralCode, orderId, REFERRER_BONUS_CREDITS],
      );
    }

    // 4. credit_transactions с идемпотентным ключом по order_id
    const idemKey = `ref_bonus_${orderId}`;
    const { rows: txInsert } = await client.query(
      `INSERT INTO credit_transactions
         (account_id, order_id, type, amount, idempotency_key, description, source)
         VALUES ($1, $2, 'credit', $3, $4, $5, 'referral_bonus')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
      [
        referrer.id,
        orderId,
        REFERRER_BONUS_CREDITS,
        idemKey,
        `Referral bonus for order ${orderId}`,
      ],
    );

    // Если транзакция реально вставилась — обновляем balance.
    // Если ON CONFLICT (т.е. webhook вызвался дважды) — баланс уже правильный.
    if (txInsert.length > 0) {
      await client.query(
        `UPDATE credit_accounts SET balance = balance + $1 WHERE id = $2`,
        [REFERRER_BONUS_CREDITS, referrer.id],
      );
    }

    await client.query('COMMIT');
    return {
      status: 'granted',
      referrerKey: referrer.customer_key,
      bonusCreditsAdded: REFERRER_BONUS_CREDITS,
    };
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[referrals.grantIfApplicable] error:', e?.message || e);
    // Не бросаем — webhook должен спокойно ответить 200.
    return { status: 'no_code' };
  } finally {
    client.release();
  }
}

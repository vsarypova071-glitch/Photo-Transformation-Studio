import { Router } from 'express';
import { db } from '../db/pool';

const router = Router();

// POST /api/credits/debit
// body: { customerKey: string, amount?: number, generationId?: string }
// Атомарно списывает amount кредитов (по умолчанию 1) с balance юзера и пишет
// в credit_transactions. Идемпотентно по generationId (если указан).
router.post('/debit', async (req, res) => {
  try {
    const { customerKey, amount = 1, generationId, description } = req.body ?? {};

    const ck = typeof customerKey === 'string' ? customerKey.trim() : '';
    const amt = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;

    if (!ck) return res.status(400).json({ error: 'customerKey required', code: 'missing_customer_key' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows: accRows } = await client.query(
        `SELECT id, balance FROM credit_accounts WHERE customer_key = $1 FOR UPDATE`,
        [ck],
      );
      const account = accRows[0];
      if (!account) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Недостаточно кредитов. Купите пакет, чтобы продолжить.',
          balance: 0,
          code: 'no_account',
        });
      }
      if (account.balance < amt) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Недостаточно кредитов. Купите пакет, чтобы продолжить.',
          balance: account.balance,
          required: amt,
          code: 'insufficient_balance',
        });
      }

      // Идемпотентность: если generationId указан — генерируем стабильный idempotency_key.
      // Повторный POST с тем же generationId не спишет повторно.
      const idemKey = generationId ? `debit_gen_${generationId}` : null;

      if (idemKey) {
        const { rows: existing } = await client.query(
          `SELECT id FROM credit_transactions WHERE idempotency_key = $1`,
          [idemKey],
        );
        if (existing.length > 0) {
          await client.query('COMMIT');
          return res.json({ ok: true, balance: account.balance, idempotent: true });
        }
      }

      const newBalance = account.balance - amt;
      await client.query(
        `UPDATE credit_accounts SET balance = $1 WHERE id = $2`,
        [newBalance, account.id],
      );

      await client.query(
        `INSERT INTO credit_transactions
           (account_id, type, amount, idempotency_key, description)
         VALUES ($1, 'debit', $2, $3, $4)`,
        [account.id, amt, idemKey, description ?? `Списание ${amt} кредит(ов) на генерацию`],
      );

      await client.query('COMMIT');
      return res.json({ ok: true, balance: newBalance, debited: amt });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[credits/debit]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db/pool';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const customerKey = String(req.query.customer_key ?? '').trim();
    if (!customerKey) return res.status(400).json({ error: 'Missing customer_key' });

    const { rows } = await db.query(
      `SELECT balance FROM credit_accounts WHERE customer_key = $1`,
      [customerKey]
    );

    res.json({ balance: rows[0]?.balance ?? 0 });
  } catch (err: any) {
    console.error('balance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

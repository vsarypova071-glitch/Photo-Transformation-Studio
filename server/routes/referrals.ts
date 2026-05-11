// /api/referrals/* — за ENABLE_REFERRALS=true. Mount только если flag=true,
// иначе express отдаст 404 на эти пути (как будто endpoints нет).

import { Router } from 'express';
import {
  getOrCreateMyCode,
  trackPending,
  isValidReferralCode,
  ReferralValidationError,
} from '../services/referrals';

const router = Router();

const APP_URL = (process.env.APP_URL || 'https://www.ai-fotosessia.ru').replace(/\/+$/, '');

// GET /api/referrals/me?customer_key=cust_...
router.get('/me', async (req, res) => {
  try {
    const ck = String(req.query.customer_key ?? '').trim();
    if (!ck) return res.status(400).json({ error: 'customer_key required', code: 'missing_customer_key' });
    if (!ck.startsWith('cust_')) return res.status(400).json({ error: 'bad customer_key', code: 'bad_customer_key' });

    const info = await getOrCreateMyCode(ck);
    res.json({
      referralCode: info.referralCode,
      referralLink: `${APP_URL}/?ref=${info.referralCode}`,
      grantedCount: info.grantedCount,
      bonusCreditsTotal: info.bonusCreditsTotal,
    });
  } catch (err: any) {
    if (err instanceof ReferralValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('[referrals/me]', err?.message || err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/referrals/track  body: { referralCode, refereeKey }
router.post('/track', async (req, res) => {
  try {
    const code = String(req.body?.referralCode ?? '').trim().toUpperCase();
    const refereeKey = String(req.body?.refereeKey ?? '').trim();

    if (!isValidReferralCode(code)) {
      return res.status(400).json({ ok: false, status: 'invalid_code' });
    }
    if (!refereeKey || !refereeKey.startsWith('cust_')) {
      return res.status(400).json({ ok: false, status: 'invalid_code' });
    }

    const result = await trackPending(code, refereeKey);
    // Не 4xx даже при self/already — это нормальная бизнес-ситуация, фронту
    // достаточно поля ok+status.
    res.json(result);
  } catch (err: any) {
    console.error('[referrals/track]', err?.message || err);
    res.status(500).json({ ok: false, status: 'internal' });
  }
});

export default router;

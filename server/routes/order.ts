import { Router } from 'express';
import { db } from '../db/pool';
import { getPayment } from '../services/yookassa';
import { creditOrderOnce } from '../services/orderCredit';

const router = Router();

const STUCK_TIMEOUT_MS = 3 * 60 * 1000;

function paymentMethodFromId(paymentId?: string | null): 'rub' | 'credits' {
  return paymentId?.startsWith('credits_') ? 'credits' : 'rub';
}

// === GET /api/order/check?order_id=... ===
router.get('/check', async (req, res) => {
  try {
    const orderId = String(req.query.order_id ?? '').trim();
    if (!orderId) return res.status(400).json({ error: 'order_id required' });

    const { rows } = await db.query(
      `SELECT id, payment_status, generation_status, results, payment_id,
              photos_count, price, updated_at, original_image, style_ids, customer_key,
              credits_purchased
         FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Если pending — спрашиваем YooKassa напрямую и фиксируем итоговый статус оплаты.
    if (order.payment_status === 'pending' && order.payment_id) {
      const yoo = await getPayment(order.payment_id);
      if (yoo) {
        if (yoo.status === 'succeeded') {
          await db.query(
            `UPDATE orders SET payment_status = 'succeeded' WHERE id = $1 AND payment_status = 'pending'`,
            [orderId],
          );
          order.payment_status = 'succeeded';
        } else if (yoo.status === 'canceled') {
          await db.query(
            `UPDATE orders SET payment_status = 'canceled', generation_status = 'canceled' WHERE id = $1`,
            [orderId],
          );
          order.payment_status = 'canceled';
          order.generation_status = 'canceled';
        }
      }
    }

    // Начисляем кредиты прямо здесь, НЕ дожидаясь вебхука YooKassa.
    // Вебхук ненадёжен (может не дойти) — тогда без этого fallback заказ зависал
    // и падал в 'error'. creditOrderOnce идемпотентна: тот же idempotency_key,
    // что и в вебхуке, повторный вызов — no-op. payment_status='succeeded' в нашей
    // БД появляется только после authoritative-проверки (вебхук или getPayment выше),
    // поэтому отдельный re-verify здесь не нужен.
    if (order.payment_status === 'succeeded' && (order.credits_purchased ?? 0) === 0 && order.payment_id) {
      try {
        const result = await creditOrderOnce(db, orderId, order.payment_id);
        if (result.status === 'credited' || result.status === 'already') {
          order.generation_status = 'credits_credited';
          order.credits_purchased = result.photos ?? order.credits_purchased;
        } else if (result.status === 'invalid_order') {
          order.generation_status = 'error';
        }
      } catch (e: any) {
        console.error('[order/check] credit failed', e?.message || e);
      }
    }

    // Stuck-таймаут: только если оплата прошла, но генерация реально зависла
    // (после того как кредиты уже обработаны выше).
    const isPaid = order.payment_status === 'succeeded';
    const terminalGen = ['done', 'error', 'canceled', 'credits_credited'];
    const isTerminal = terminalGen.includes(order.generation_status);
    const stuck = !isTerminal &&
      (order.generation_status === 'running' || order.generation_status === 'waiting') &&
      Date.now() - new Date(order.updated_at).getTime() > STUCK_TIMEOUT_MS;

    if (isPaid && stuck) {
      await db.query(`UPDATE orders SET generation_status = 'error' WHERE id = $1`, [orderId]);
      order.generation_status = 'error';
    }

    res.json({
      orderId: order.id,
      paymentStatus: order.payment_status,
      generationStatus: order.generation_status,
      results: order.results || [],
      photosCount: order.photos_count,
      price: order.price,
      paymentMethod: paymentMethodFromId(order.payment_id),
      originalImage: order.original_image || null,
      styleIds: order.style_ids || [],
      customerKey: order.customer_key || null,
      creditsPurchased: order.credits_purchased ?? 0,
    });
  } catch (err: any) {
    console.error('[order/check]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// === GET /api/order/find-recent?customer_key=cust_... ===
router.get('/find-recent', async (req, res) => {
  try {
    const customerKey = String(req.query.customer_key ?? '').trim();
    if (!customerKey || !customerKey.startsWith('cust_')) {
      return res.status(400).json({ error: 'valid customer_key required' });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { rows } = await db.query(
      `SELECT id, payment_status, generation_status, results, photos_count, tariff_id,
              payment_id, price, created_at, original_image, style_ids
         FROM orders
        WHERE customer_key = $1
          AND payment_status = 'succeeded'
          AND generation_status IN ('done','running','waiting','error','credits_credited')
          AND created_at >= $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [customerKey, since.toISOString()],
    );

    const order = rows[0];
    if (!order) return res.json({ found: false });

    const hasResults = Array.isArray(order.results) && order.results.length > 0;
    if (order.generation_status === 'done' && !hasResults) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      orderId: order.id,
      paymentStatus: order.payment_status,
      generationStatus: order.generation_status,
      results: order.results || [],
      photosCount: order.photos_count,
      tariffId: order.tariff_id,
      price: order.price,
      paymentMethod: paymentMethodFromId(order.payment_id),
      createdAt: order.created_at,
      originalImage: order.original_image || null,
      styleIds: order.style_ids || [],
    });
  } catch (err: any) {
    console.error('[order/find-recent]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;

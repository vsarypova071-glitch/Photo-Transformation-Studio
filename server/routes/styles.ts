// GET /api/styles?category=&include_club=
//
// Read-only каталог стилей из БД.
// Назначение: фронт перестаёт зависеть от хардкоженного src/lib/constants.ts
// и может видеть новые/обновлённые стили без redeploy.
//
// Backwards-compat:
//   - Если таблица styles пустая (миграция ещё не применена) — отдаём 200 [].
//     Фронт сам сделает fallback на bundle-ный constants.ts.
//   - Если БД недоступна — 503; фронт делает то же самое.
//
// CLUB:
//   - club_only стили показываются только если ?include_club=true (фронт-фильтр).
//   - Реальная enforcement (запрет генерации club_only без подписки) живёт
//     в /api/generation/single, а не здесь.

import { Router } from 'express';
import { db } from '../db/pool';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const includeClub =
      String(req.query.include_club ?? '').toLowerCase() === 'true' ||
      String(req.query.include_club ?? '') === '1';

    const where: string[] = ['active = true'];
    const params: unknown[] = [];
    if (category) {
      params.push(category);
      where.push(`(category = $${params.length} OR legacy_category = $${params.length})`);
    }
    if (!includeClub) {
      where.push('club_only = false');
    }

    const sql = `
      SELECT id, title, description, preview_url, category, legacy_category,
             club_only, sort_order
        FROM styles
       WHERE ${where.join(' AND ')}
       ORDER BY sort_order, title
    `;

    const { rows } = await db.query(sql, params);
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        previewUrl: r.preview_url,
        category: r.category,
        legacyCategory: r.legacy_category,
        // prompt intentionally omitted — server-side only
        clubOnly: r.club_only,
        sortOrder: r.sort_order,
      })),
      count: rows.length,
    });
  } catch (err: any) {
    // Если миграция 002 ещё не применена — таблицы нет → 42P01.
    // Возвращаем 200 [] чтобы фронт безболезненно ушёл в fallback.
    if (err?.code === '42P01') {
      console.warn('[styles] table styles does not exist — returning empty list');
      return res.json({ items: [], count: 0, fallback: true });
    }
    console.error('[styles]', err?.message || err);
    res.status(503).json({ error: 'styles temporarily unavailable' });
  }
});

export default router;

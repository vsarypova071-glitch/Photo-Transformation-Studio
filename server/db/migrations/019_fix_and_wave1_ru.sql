-- Migration 019: Fix private_jet → БИЗНЕС-КЛАСС, restore legend_warrior, translate wave-1 titles
--
-- Изменения:
--   private_jet:    title Викинг  → БИЗНЕС-КЛАСС,  prompt [MEN: VIKING]  → [MEN: PRIVATE JET] (jet concept)
--   legend_warrior: title Лидер   → ЛЕГЕНДАРНЫЙ ВОИН, prompt [MEN: LEADER] → [MEN: LEGEND WARRIOR] (warrior concept)
--   men_desert_king:  DESERT KING      → Повелитель пустыни  (только title, prompt не трогаем)
--   men_big_catch:    BIG CATCH        → Большой улов
--   men_king_ocean:   KING OF THE OCEAN → Король океана
--   men_master_life:  MASTER OF LIFE   → Хозяин жизни
--
-- НЕ меняем: slug/id, sort_order, prompt wave-1, backend, generation pipeline
--
-- Откат:
--   UPDATE styles SET title='Викинг',  prompt='[MEN: VIKING]...'  WHERE id='private_jet';
--   UPDATE styles SET title='Лидер',   prompt='[MEN: LEADER]...'  WHERE id='legend_warrior';
--   UPDATE styles SET title='DESERT KING'       WHERE id='men_desert_king';
--   UPDATE styles SET title='BIG CATCH'         WHERE id='men_big_catch';
--   UPDATE styles SET title='KING OF THE OCEAN' WHERE id='men_king_ocean';
--   UPDATE styles SET title='MASTER OF LIFE'    WHERE id='men_master_life';
-- ============================================================================

-- ── БИЗНЕС-КЛАСС (private_jet) ───────────────────────────────────────────────
UPDATE styles SET
  title       = 'БИЗНЕС-КЛАСС',
  description = 'Luxury перелёт — private jet, стиль, спокойствие. Дорогая жизнь над облаками.',
  prompt      = '[MEN: PRIVATE JET]
Luxury cinematic portrait of a confident successful man relaxing inside a private jet cabin. Premium knitwear, luxury watch catching golden light, warm sunlight streaming through oval airplane windows, sophisticated expensive atmosphere, masculine calm confidence, cinematic editorial photography, photorealistic luxury lifestyle.'
WHERE id = 'private_jet';

-- ── ЛЕГЕНДАРНЫЙ ВОИН (legend_warrior) ────────────────────────────────────────
UPDATE styles SET
  title       = 'ЛЕГЕНДАРНЫЙ ВОИН',
  description = 'Воин в тёмных доспехах в заснеженных горах — эпика, сила, кинематографичная тьма.',
  prompt      = '[MEN: LEGEND WARRIOR]
Epic cinematic portrait of a rugged powerful warrior wearing dark forged medieval armor and heavy fur cloak standing in dramatic snowy mountains. Intense direct eyes, dark stormy sky, cinematic movie lighting cutting through clouds, realistic armor textures, dark fantasy-realism aesthetic, photorealistic warrior epic.'
WHERE id = 'legend_warrior';

-- ── Wave-1: перевод UI-title на русский ──────────────────────────────────────
UPDATE styles SET title = 'Повелитель пустыни' WHERE id = 'men_desert_king';
UPDATE styles SET title = 'Большой улов'       WHERE id = 'men_big_catch';
UPDATE styles SET title = 'Король океана'       WHERE id = 'men_king_ocean';
UPDATE styles SET title = 'Хозяин жизни'        WHERE id = 'men_master_life';

-- ── Sanity check ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, title, left(prompt, 30) AS tag
      FROM styles
     WHERE id IN (
       'private_jet','legend_warrior',
       'men_desert_king','men_big_catch','men_king_ocean','men_master_life'
     )
     ORDER BY sort_order
  LOOP
    RAISE NOTICE 'Migration 019: id=%-20s title=%-25s prompt_tag=%s',
      r.id, r.title, r.tag;
  END LOOP;
END $$;

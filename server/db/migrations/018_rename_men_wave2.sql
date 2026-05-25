-- Migration 018: Rename MEN wave-2 styles + update prompts to match new concepts
-- Изменяем: title, description, prompt для 4 стилей второй волны.
-- ID, sort_order, active, club_only, category, legacy_category — НЕ меняем.
--
-- Было → Стало:
--   tech_founder:   Стартап-Миллионер  → Интеллектуал   [MEN: TECH FOUNDER]   → [MEN: INTELLECTUAL]
--   private_jet:    Частный Джет       → Викинг         [MEN: PRIVATE JET]    → [MEN: VIKING]
--   surfer:         Покоритель Волн    → Атлет          [MEN: SURFER]         → [MEN: ATHLETE]
--   legend_warrior: Легендарный Воин   → Лидер          [MEN: LEGEND WARRIOR] → [MEN: LEADER]
--
-- Откат (вручную):
--   UPDATE styles SET title='Стартап-Миллионер', description='Основатель стартапа в стильном кафе — интеллект, уверенность, предпринимательская энергия.',
--     prompt='[MEN: TECH FOUNDER]
-- Premium lifestyle portrait of a modern tech founder sitting in a stylish specialty cafe. Intelligent confident eyes looking into camera, luxury casual outfit, laptop and artisan coffee on table, warm cinematic natural lighting, realistic skin texture, modern entrepreneur energy, editorial photography, photorealistic masterpiece.'
--   WHERE id = 'tech_founder';
--   (аналогично для остальных 3 — см. Migration 017)
-- ============================================================================

-- ── ИНТЕЛЛЕКТУАЛ ─────────────────────────────────────────────────────────────
UPDATE styles SET
  title       = 'Интеллектуал',
  description = 'Умный образованный мужчина — интеллект, статус, уверенность. Стильный кэжуал, аналитический взгляд.',
  prompt      = '[MEN: INTELLECTUAL]
Premium cinematic editorial portrait of an intelligent, educated and confident man in a luxurious private library or modern minimal workspace. Sharp focused intelligent eyes looking directly into the camera, refined business casual or smart casual outfit, warm cinematic amber light, realistic masculine skin texture, intellectual energy and quiet authority, GQ editorial photography, photorealistic masterpiece.'
WHERE id = 'tech_founder';

-- ── ВИКИНГ ───────────────────────────────────────────────────────────────────
UPDATE styles SET
  title       = 'Викинг',
  description = 'Мощный викинг в суровом северном пейзаже — мех, кожа, длинные волосы, эпическая сила.',
  prompt      = '[MEN: VIKING]
Epic cinematic portrait of a powerful Norse Viking warrior standing in a dramatic Nordic coastal landscape. Long hair and full thick beard, wearing heavy fur and aged leather warrior clothing, rugged intense masculine features, cold dramatic Norse stormy sky, powerful cinematic directional light, realistic fur and leather texture, raw primal masculine power and legendary warrior energy, photorealistic premium cinematic portrait.'
WHERE id = 'private_jet';

-- ── АТЛЕТ ────────────────────────────────────────────────────────────────────
UPDATE styles SET
  title       = 'Атлет',
  description = 'Спортивный мужчина — атлетичная форма, энергия, современный фитнес-образ.',
  prompt      = '[MEN: ATHLETE]
Cinematic editorial portrait of a fit athletic man in premium sportswear, in a modern luxury gym with panoramic city views or a premium outdoor training environment at golden hour. Strong athletic masculine physique, confident grounded energy, premium performance activewear, dynamic editorial composition, natural cinematic light, realistic skin texture, elite fitness lifestyle photography, photorealistic masterpiece.'
WHERE id = 'surfer';

-- ── ЛИДЕР ────────────────────────────────────────────────────────────────────
UPDATE styles SET
  title       = 'Лидер',
  description = 'Харизматичный лидер — статус, влияние, уверенность. Деловой образ, premium стиль.',
  prompt      = '[MEN: LEADER]
Powerful cinematic portrait of a charismatic confident leader in a premium executive business setting. Impeccably tailored luxury suit, commanding authority and calm dominant energy, panoramic city skyline office or architectural luxury lobby, warm cinematic directional light, quiet masculine power radiating from every detail, GQ editorial photography, photorealistic masterpiece.'
WHERE id = 'legend_warrior';

-- ── Sanity check ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_intellectual INTEGER;
  n_viking       INTEGER;
  n_athlete      INTEGER;
  n_leader       INTEGER;
BEGIN
  SELECT count(*) INTO n_intellectual FROM styles WHERE id = 'tech_founder'   AND title = 'Интеллектуал';
  SELECT count(*) INTO n_viking       FROM styles WHERE id = 'private_jet'    AND title = 'Викинг';
  SELECT count(*) INTO n_athlete      FROM styles WHERE id = 'surfer'         AND title = 'Атлет';
  SELECT count(*) INTO n_leader       FROM styles WHERE id = 'legend_warrior' AND title = 'Лидер';

  RAISE NOTICE 'Migration 018: Интеллектуал=% Викинг=% Атлет=% Лидер=% (expect all 1)',
    n_intellectual, n_viking, n_athlete, n_leader;
END $$;

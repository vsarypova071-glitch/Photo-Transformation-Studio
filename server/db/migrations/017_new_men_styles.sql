-- Migration 017: New MEN Premium Cinematic styles (4 styles — wave 2)
-- Additive: ON CONFLICT DO NOTHING — безопасно запускать повторно.
--
-- Категория: legacy_category = 'men'
-- Превью: null — берётся из bundle через adapt() в styles.ts.
-- Промпт: содержит [MEN: <NAME>] тег для сервер-сайд детектирования в buildPrompt().
--
-- Откат (вручную):
--   DELETE FROM styles WHERE id IN
--     ('tech_founder','private_jet','surfer','legend_warrior');
-- ============================================================================

INSERT INTO styles (id, title, description, category, legacy_category, preview_url, prompt, sort_order, active, club_only)
VALUES

-- ── СТАРТАП-МИЛЛИОНЕР ────────────────────────────────────────────────────────
(
  'tech_founder',
  'Стартап-Миллионер',
  'Основатель стартапа в стильном кафе — интеллект, уверенность, предпринимательская энергия.',
  NULL,
  'men',
  NULL,
  '[MEN: TECH FOUNDER]
Premium lifestyle portrait of a modern tech founder sitting in a stylish specialty cafe. Intelligent confident eyes looking into camera, luxury casual outfit, laptop and artisan coffee on table, warm cinematic natural lighting, realistic skin texture, modern entrepreneur energy, editorial photography, photorealistic masterpiece.',
  140,
  true,
  false
),

-- ── ЧАСТНЫЙ ДЖЕТ ─────────────────────────────────────────────────────────────
(
  'private_jet',
  'Частный Джет',
  'Успешный мужчина в салоне частного самолёта — роскошь, спокойствие, настоящая свобода.',
  NULL,
  'men',
  NULL,
  '[MEN: PRIVATE JET]
Luxury cinematic portrait of a confident successful man relaxing inside a private jet cabin. Premium knitwear, luxury watch catching golden light, warm sunlight streaming through oval airplane windows, sophisticated expensive atmosphere, masculine calm confidence, cinematic editorial photography, photorealistic luxury lifestyle.',
  150,
  true,
  false
),

-- ── ПОКОРИТЕЛЬ ВОЛН ──────────────────────────────────────────────────────────
(
  'surfer',
  'Покоритель Волн',
  'Атлетичный сёрфер на берегу океана — закат, прибой, мужская уверенность.',
  NULL,
  'men',
  NULL,
  '[MEN: SURFER]
Cinematic portrait of an athletic surfer standing on a beach at golden hour sunset holding a surfboard. Wet neoprene wetsuit, breaking ocean waves behind, golden hour sunlight, realistic wet skin texture with water droplets, calm masculine confidence, cinematic lifestyle photography, photorealistic masterpiece.',
  160,
  true,
  false
),

-- ── ЛЕГЕНДАРНЫЙ ВОИН ─────────────────────────────────────────────────────────
(
  'legend_warrior',
  'Легендарный Воин',
  'Воин в тёмных доспехах в заснеженных горах — эпика, сила, кинематографичная тьма.',
  NULL,
  'men',
  NULL,
  '[MEN: LEGEND WARRIOR]
Epic cinematic portrait of a rugged powerful warrior wearing dark forged medieval armor and heavy fur cloak standing in dramatic snowy mountains. Intense direct eyes, dark stormy sky, cinematic movie lighting cutting through clouds, realistic armor textures, dark fantasy-realism aesthetic, photorealistic warrior epic.',
  170,
  true,
  false
)

ON CONFLICT (id) DO NOTHING;

-- ── Sanity check ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_men INTEGER;
BEGIN
  SELECT count(*) INTO n_men
    FROM styles
   WHERE legacy_category = 'men' AND active = true;

  RAISE NOTICE 'Migration 017: men_styles active = % (expect 8)', n_men;
END $$;

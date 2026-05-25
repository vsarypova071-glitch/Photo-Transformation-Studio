-- Migration 021: Kids Wave-2 styles — UPSERT 8 стилей + rename dikaya_priroda_kids
--
-- Контекст:
--   8 детских стилей «второй волны» присутствовали в production БД, но не были
--   зафиксированы ни в одном migration-файле репозитория. Это значит:
--     • rollback / reseed потеряли бы все 8 стилей без возможности восстановления;
--     • CI/staging-стенды не имеют этих стилей;
--     • bundle constants.ts имел для них prompt = '' → при bundle-fallback
--       buildPrompt() работал только через childLifestyleBlock без стиль-специфики.
--
--   Миграция исправляет оба пробела:
--     1. Фиксирует записи в репо (идемпотентный UPSERT).
--     2. Добавляет стиль-специфичный prompt, который детектируется в buildPrompt()
--        через тег [KIDS: <NAME>] → активирует childLifestyleBlock + (для little_ceo_girl)
--        littleCeoGirlBlock.
--
--   dikaya_priroda_kids переименован в «ЮНЫЙ СЛЕДОПЫТ»:
--     • ID не меняется — существующие records в generations не затронуты.
--     • Меняются только title и description.
--
-- Безопасность:
--   • ON CONFLICT (id) DO UPDATE — идемпотентно, повторный запуск безопасен.
--   • Существующие generation records ссылаются на style_id, не title — переименование
--     не ломает историю.
--   • preview_url = NULL: реальные превью лежат на VPS в /style-previews/kids/ и
--     отдаются nginx-ом same-origin. Null в БД → adapt() в styles.ts подставит
--     bundle-значение из constants.ts (server-side URL /style-previews/kids/...).
--
-- Откат (вручную):
--   DELETE FROM styles WHERE id IN (
--     'kosmos','yunyj_reporter','malyj_lider','ledyanaya_skazka',
--     'yunaya_zvezda','dikaya_priroda_kids','yunyj_volshebnik','little_ceo_girl'
--   );
-- ============================================================================

INSERT INTO styles (
  id, title, description, prompt,
  category, legacy_category, sort_order, active, club_only, preview_url
)
VALUES

-- ── 1. ЮНЫЙ КОСМОНАВТ ────────────────────────────────────────────────────────
(
  'kosmos',
  'ЮНЫЙ КОСМОНАВТ',
  'Маленький герой в космическом костюме исследует вселенную с широко открытыми глазами.',
  '[KIDS: YOUNG COSMONAUT]
Cinematic portrait of a child in a premium white space suit with vintage-style helmet and visor, inside a beautifully lit space capsule interior or floating in a magical cosmic void surrounded by stars and vivid nebula colours. NASA cinematic aesthetic — warm amber instrument panel lights, deep blue cosmic atmosphere. The child radiates wonder, courage and bright-eyed adventure. Premium production design, real emotion, age-appropriate heroic energy. Beautiful, inspiring, Netflix-level cinematic quality. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1060, true, false, NULL
),

-- ── 2. ЮНЫЙ РЕПОРТЁР ─────────────────────────────────────────────────────────
(
  'yunyj_reporter',
  'ЮНЫЙ РЕПОРТЁР',
  'Маленький журналист с камерой и блокнотом: любопытство, уверенность и городские репортажи.',
  '[KIDS: YOUNG REPORTER]
Cinematic portrait of a child journalist with a vintage camera slung around their neck and a small reporter''s notebook in hand. Setting: vibrant city street with warm editorial daylight, or a lively newspaper office full of character. Curious intelligent expression, urban energy, alive with genuine curiosity. Stylish casual clothing with a small press pass or badge. Bright editorial photography style — confident, quick-eyed, real emotion. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1070, true, false, NULL
),

-- ── 3. МАЛЫЙ ЛИДЕР ───────────────────────────────────────────────────────────
(
  'malyj_lider',
  'МАЛЫЙ ЛИДЕР',
  'Уверенный маленький лидер с ярким характером и атмосферой будущего чемпиона.',
  '[KIDS: LITTLE LEADER]
Cinematic portrait of a charismatic, self-assured child radiating natural leadership energy — confident posture, bright engaged eyes, warm genuine expression. Premium modern setting: sunlit modern classroom, architectural outdoor space, or clean minimal editorial environment. Smart casual clothing, neat styling, natural leadership presence. Inspirational, warm, emotionally alive — not stiff, not posed, genuinely confident and forward-looking. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1080, true, false, NULL
),

-- ── 4. ЛЕДЯНАЯ СКАЗКА ────────────────────────────────────────────────────────
(
  'ledyanaya_skazka',
  'ЛЕДЯНАЯ СКАЗКА',
  'Зимняя магия: снежные пейзажи, сказочная атмосфера, элегантный winter fairy tale.',
  '[KIDS: WINTER FAIRY TALE]
Cinematic portrait of a child in an enchanted winter fairy tale world — glittering snow-covered landscape, magical frozen forest with soft blue and silver cinematic light, delicate snowflakes suspended in air. Elegant winter costume in ice blue, silver or white with delicate sparkle details appropriate for the child. Dreamy wonder-filled expression, fairy tale magic atmosphere, premium cinematic production. Soft glowing light, beautiful winter palette, warm and enchanting energy. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1090, true, false, NULL
),

-- ── 5. ЮНАЯ ЗВЕЗДА ───────────────────────────────────────────────────────────
(
  'yunaya_zvezda',
  'ЮНАЯ ЗВЕЗДА',
  'Маленькая звезда сцены: артистизм, свет прожекторов и магия выступления.',
  '[KIDS: YOUNG STAR]
Cinematic portrait of a child performer on a stage or under a bright artistic spotlight — confident expressive energy of a young star in their element. Performance setting: concert stage with warm golden spotlight, elegant recital hall, or vibrant artistic studio. Beautiful costume appropriate to their art form. Natural performance energy — joy, confidence, artistic magnetism, real delight. Premium production photography, warm stage lighting, genuine emotional expression. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1100, true, false, NULL
),

-- ── 6. ЮНЫЙ СЛЕДОПЫТ (was: ДИКАЯ ПРИРОДА) ────────────────────────────────────
-- ID остаётся 'dikaya_priroda_kids' — generation records не ломаются.
-- Title изменён на «ЮНЫЙ СЛЕДОПЫТ», чтобы не конфликтовать с женским стилем «ДИКАЯ ПРИРОДА».
(
  'dikaya_priroda_kids',
  'ЮНЫЙ СЛЕДОПЫТ',
  'Маленький исследователь в дикой природе: лес, горы, приключение и cinematic свобода.',
  '[KIDS: YOUNG EXPLORER]
Cinematic portrait of a child adventurer in a beautiful natural setting — sunlit forest with dappled light, open mountain meadow, rocky path beside a clear stream, or golden-hour wilderness. Premium outdoor adventure clothing: quality explorer jacket, comfortable gear in natural earthy tones. Curious, brave, alive — exploring the world with genuine wonder and confident energy. Real emotional connection to nature, authentic adventure spirit. Cinematic natural light, beautiful landscape depth. Age-appropriate, warm, real. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1110, true, false, NULL
),

-- ── 7. ЮНЫЙ ВОЛШЕБНИК ────────────────────────────────────────────────────────
(
  'yunyj_volshebnik',
  'ЮНЫЙ ВОЛШЕБНИК',
  'Маленький волшебник с книгой заклинаний: фэнтезийная атмосфера, магия и cinematic wonder.',
  '[KIDS: YOUNG WIZARD]
Cinematic portrait of a child wizard in a magical world — ancient library filled with glowing spell books and warm candle light, mystical forest with magical light rays filtering through old trees, or enchanted stone tower room. Elegant wizard robe in deep burgundy or midnight blue with subtle magical embroidery details, holding a beautiful worn spell book or glowing wand. Wonder, intelligence, quiet magical power in the child''s expression. Fantasy-realism aesthetic — cinematic and beautiful, not cartoon. Warm magical light, rich atmospheric depth, real emotion. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1120, true, false, NULL
),

-- ── 8. МАЛЕНЬКАЯ ЛЕДИ-БОСС ────────────────────────────────────────────────────
-- Тег [LITTLE CEO GIRL] детектируется isLittleCeoGirl в buildPrompt():
--   /little.ceo|LITTLE CEO|МАЛЕНЬКАЯ ЛЕДИ|.../i.test(stylePrompt) → littleCeoGirlBlock.
(
  'little_ceo_girl',
  'МАЛЕНЬКАЯ ЛЕДИ-БОСС',
  'Кинематографический портрет уверенной маленькой леди в элегантном деловом костюме.',
  '[LITTLE CEO GIRL]
Cinematic portrait of a confident, charismatic young girl in an elegant tailored business suit. Modern executive office with panoramic skyline windows and warm natural daylight, or a premium architectural creative workspace. The child looks intelligent, curious, calm and naturally self-assured — not posing like an adult model, but radiating genuine future-leader energy with real child warmth. Quiet luxury aesthetic: tailored blazer, clean white shirt, premium fabrics, minimal elegant styling, natural hairstyle. Emotion: confidence, curiosity, intelligence, warmth, dream-big focus. Cinematic realism, soft beautiful daylight, alive expressive eyes. Preserve the exact facial identity and age of the reference child.',
  'Детские', NULL, 1130, true, false, NULL
)

ON CONFLICT (id) DO UPDATE SET
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  prompt        = EXCLUDED.prompt,
  category      = EXCLUDED.category,
  sort_order    = EXCLUDED.sort_order,
  active        = EXCLUDED.active,
  club_only     = EXCLUDED.club_only;

-- ── Sanity check ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  n_total    INTEGER;
  n_renamed  INTEGER;
  n_ceo_tag  INTEGER;
BEGIN
  -- Все 8 стилей присутствуют и активны
  SELECT count(*) INTO n_total
    FROM styles
   WHERE id IN (
     'kosmos','yunyj_reporter','malyj_lider','ledyanaya_skazka',
     'yunaya_zvezda','dikaya_priroda_kids','yunyj_volshebnik','little_ceo_girl'
   ) AND active = true;

  -- Переименование dikaya_priroda_kids
  SELECT count(*) INTO n_renamed
    FROM styles
   WHERE id = 'dikaya_priroda_kids' AND title = 'ЮНЫЙ СЛЕДОПЫТ';

  -- little_ceo_girl содержит детектируемый тег
  SELECT count(*) INTO n_ceo_tag
    FROM styles
   WHERE id = 'little_ceo_girl' AND prompt LIKE '%LITTLE CEO%';

  RAISE NOTICE 'Migration 021: kids_wave2_active=% (expect 8), dikaya renamed=% (expect 1), ceo_tag=% (expect 1)',
    n_total, n_renamed, n_ceo_tag;

  IF n_total < 8 THEN
    RAISE EXCEPTION 'Migration 021 FAILED: only % / 8 kids wave-2 styles active', n_total;
  END IF;

  -- Детальный вывод
  FOR r IN
    SELECT id, title, active, length(prompt) AS plen, left(prompt, 22) AS tag
      FROM styles
     WHERE id IN (
       'kosmos','yunyj_reporter','malyj_lider','ledyanaya_skazka',
       'yunaya_zvezda','dikaya_priroda_kids','yunyj_volshebnik','little_ceo_girl'
     )
     ORDER BY sort_order
  LOOP
    RAISE NOTICE '  %-25s  title=%-30s  active=%  prompt_len=%',
      r.id, r.title, r.active, r.plen;
  END LOOP;

  RAISE NOTICE 'Migration 021: OK';
END $$;

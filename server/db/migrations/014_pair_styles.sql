-- Migration 014: pair / together styles (Phase 5).
-- Все изменения ADDITIVE: ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- Старые записи в generations, styles, credit_transactions — не трогаются.
--
-- Что добавляет:
--   1. generations.source_photo_b TEXT             — второй source для парных генераций.
--   2. generations.credits_charged SMALLINT        — сколько кредитов реально списано (1 или 2).
--   3. 5 стилей категории 'Парные фото' в таблицу styles.
--
-- Безопасность отката (вручную):
--   DELETE FROM styles WHERE id IN
--     ('couple_love_story','mother_child','father_child','best_friends','business_duo');
--   ALTER TABLE generations DROP COLUMN IF EXISTS source_photo_b;
--   ALTER TABLE generations DROP COLUMN IF EXISTS credits_charged;
-- ============================================================================

-- ============================================================================
-- 1. Колонки для парных генераций
-- ============================================================================
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS source_photo_b   TEXT;

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS credits_charged  SMALLINT NOT NULL DEFAULT 1
  CHECK (credits_charged IN (1, 2));

-- ============================================================================
-- 2. Пять стилей категории "Парные фото"
-- Промпты — style-block, используется в buildPairPrompt() из pairPrompts.ts.
-- Полный системный промпт (identity lock A + B, composition rules) добавляет
-- сам buildPairPrompt() на бэкенде — в БД только стилевая часть.
-- ============================================================================
INSERT INTO styles (id, title, description, category, prompt, sort_order, active, club_only)
VALUES

(
  'couple_love_story',
  'LOVE STORY',
  'Cinematic romantic portrait — двое в атмосфере тёплого кино.',
  'Парные фото',
  '[STYLE: ROMANTIC COUPLE PORTRAIT]
Premium cinematic couple photography — editorial love story session.
Setting: elegant natural environment — golden hour park, warm city street cafe, or minimal studio with warm ambient tones.
Mood: authentic connection, genuine emotion, natural intimacy — not staged or overly posed.
Lighting: warm soft golden hour light or softly diffused warm studio — cinematic film quality.
Both subjects close together, natural interaction — a subtle shared glance, gentle touch, or walking side by side.
Color palette: warm gold, cream, dusty rose, soft terracotta — romantic and premium.
Fashion: Person A in elegant feminine attire, Person B in premium smart casual or tailored jacket.
NOT a fashion shoot — this is an emotional portrait of two real, distinct people.',
  10, true, false
),

(
  'mother_child',
  'МАМА И РЕБЁНОК',
  'Тёплая семейная фотосессия — настоящий момент близости.',
  'Парные фото',
  '[STYLE: FAMILY PORTRAIT — MOTHER AND CHILD]
Premium warm family photography — authentic mother-and-child connection.
Setting: bright airy indoor with warm window light (cozy modern home, nursery, light-filled room)
or outdoor soft-light park with green natural background.
Mood: tenderness, unconditional love, protection — genuine authentic family moment, real emotion.
Lighting: soft warm natural window light or diffused outdoor light — never harsh, always warm.
Natural interaction between the two subjects — a hug, shared laughter, child in arms, or playful gentle moment.
Color palette: warm cream, sage green, soft ivory, warm white — timeless and premium.
Fashion: Person A in soft feminine attire; Person B (child) in simple clean comfortable clothing.
NOT a staged studio portrait — a real candid premium family moment.',
  20, true, false
),

(
  'father_child',
  'ПАПА И РЕБЁНОК',
  'Сильный и тёплый семейный образ — отец и ребёнок.',
  'Парные фото',
  '[STYLE: FAMILY PORTRAIT — FATHER AND CHILD]
Premium family photography — authentic strong and warm father-child bond.
Setting: urban outdoor with clean natural light, modern park, or minimal indoor with clean background.
Mood: strength, warmth, love, playful protection — genuine authentic family energy, real connection.
Lighting: clean soft natural light or open shade outdoor — natural and premium.
Natural interaction between the two subjects — shoulder ride, child on lap, hands held, shared playful activity.
Color palette: neutral navy, warm grey, cream, warm white — strong yet tender.
Fashion: Person A in smart casual masculine attire; Person B (child) in simple relaxed clothing.
NOT a corporate portrait — an authentic premium family moment with real emotion.',
  30, true, false
),

(
  'best_friends',
  'ЛУЧШИЕ ДРУЗЬЯ',
  'Lifestyle editorial двух людей — настоящая дружба в кадре.',
  'Парные фото',
  '[STYLE: BEST FRIENDS LIFESTYLE EDITORIAL]
Premium lifestyle photography — authentic friendship portrait, real energy between two people.
Setting: urban rooftop with city view, vibrant city street, bright coffee terrace with flowers, or clean bright studio.
Mood: joy, confidence, genuine fun — real laughter, authentic chemistry, unstaged energy.
Lighting: bright clean natural daylight or warm golden hour — bright and alive.
Both subjects relaxed and natural — real interaction, genuine smiles, authentic lifestyle energy.
Color palette: bright and clean — white, warm neutrals, pops of coral or sky blue.
Fashion: both subjects in stylish premium casual attire matching the setting.
Editorial lifestyle quality — real people with real friendship, premium aesthetic, not a posed shoot.',
  40, true, false
),

(
  'business_duo',
  'ДЕЛОВОЙ ДУЭТ',
  'Premium business portrait двух людей — партнёрство, успех, статус.',
  'Парные фото',
  '[STYLE: BUSINESS DUO PORTRAIT]
Premium corporate photography — professional two-person business portrait.
Setting: modern office interior with clean architectural lines, glass facade with city view, or neutral premium grey/white studio.
Mood: confidence, authority, professional partnership — premium executive energy and mutual trust.
Lighting: clean professional daylight or controlled studio light — sharp and authoritative.
Both subjects standing or seated together, professional posture, strong business presence, direct gaze.
Color palette: deep navy, charcoal, warm grey, clean white — premium and authoritative.
Fashion: both subjects in premium professional business attire (suits, tailored jackets).
Premium editorial corporate quality — real executives, real partnership, professional brand imagery.',
  50, true, false
)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Sanity check
-- ============================================================================
DO $$
DECLARE
  n_pair     INTEGER;
  n_col_b    INTEGER;
  n_col_cred INTEGER;
BEGIN
  SELECT count(*) INTO n_pair
    FROM styles
   WHERE category = 'Парные фото' AND active = true;

  SELECT count(*) INTO n_col_b
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'generations'
     AND column_name = 'source_photo_b';

  SELECT count(*) INTO n_col_cred
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'generations'
     AND column_name = 'credits_charged';

  RAISE NOTICE 'Migration 014: pair_styles=% (expect 5), col_source_b=%, col_credits_charged=%',
    n_pair, n_col_b, n_col_cred;
END $$;

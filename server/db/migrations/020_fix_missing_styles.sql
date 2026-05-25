-- Migration 020: Fix missing styles — UPSERT social_portrait + bw_portrait
--
-- Проблемы, которые решает эта миграция:
--
--   1. social_portrait — стиль присутствовал в bundle-константах (src/lib/constants.ts)
--      и в migration 009 был UPDATE для него, но ни в одной предшествующей миграции
--      не было INSERT. Следствие: UPDATE в 009 затрагивал 0 строк, стиль не существовал
--      в БД. Бэкенд возвращал 400 «Style not found», либо — если запись создавалась
--      вручную — buildPrompt() получал пустой prompt, isSocialPortrait = false, и стиль
--      проходил через полный luxury/editorial pipeline вместо clean portrait.
--
--   2. bw_portrait — migration 010 добавляла его через INSERT + ON CONFLICT DO UPDATE,
--      что корректно. Эта миграция повторяет UPSERT как «belt and suspenders»:
--      гарантирует, что запись есть в БД даже если 010 была применена без DO UPDATE.
--      Также синхронизирует prompt с bundle-константой (src/lib/constants.ts).
--
-- Безопасность:
--   • ON CONFLICT (id) DO UPDATE — идемпотентно, повторный запуск не ломает данные.
--   • sort_order: social_portrait = 5 (первый в списке realistic), bw_portrait = 160.
--   • legacy_category = 'realistic' — оба стиля попадают во вкладку «ЖЕНСКИЕ» на фронте.
--   • club_only = false — доступны всем пользователям.
--   • preview_url = NULL — берётся из bundle через adapt() в styles.ts.
--
-- Откат (вручную):
--   DELETE FROM styles WHERE id IN ('social_portrait', 'bw_portrait');
-- ============================================================================

-- ── 1. ОБРАЗ ДЛЯ СОЦСЕТЕЙ (social_portrait) ─────────────────────────────────
--
-- Prompt начинается с тега [PREMIUM INFLUENCER PORTRAIT], который детектируется
-- в server/services/prompts.ts:
--   const isSocialPortrait = /PREMIUM INFLUENCER PORTRAIT|.../i.test(input.stylePrompt)
-- При совпадении buildPrompt() применяет socialPortraitBlock и ОТКЛЮЧАЕТ:
--   auraBlock, luxuryAdaptBlock, fashionBlock, magnetismBlock, femininityBlock.
-- Результат: чистый натуральный портрет, а не luxury editorial.

INSERT INTO styles (
  id, title, description, prompt,
  category, legacy_category, sort_order, active, club_only, preview_url
)
VALUES (
  'social_portrait',
  'ОБРАЗ ДЛЯ СОЦСЕТЕЙ',
  'Premium influencer aesthetic — естественный, чистый, дорогой.',
  '[PREMIUM INFLUENCER PORTRAIT]
Modern natural lifestyle portrait — authentic, warm, effortlessly expensive.

Setting: sunlit Scandinavian apartment with white walls and warm oak details, soft beautiful window light streaming across clean surfaces; OR a stylish city specialty coffee shop with natural bright daylight and clean neutral background; OR an airy modern home workspace with indoor greenery, soft light, minimal premium decor.

Atmosphere: real elevated everyday life. A real person in a real beautiful moment — not a fashion campaign, not a luxury estate. Warm, approachable, naturally expensive.

Lighting: soft natural window light or gentle overcast daylight. Clean, even, warm, flattering. No dramatic shadows. No cinematic contrast. No professional studio strobes.

Styling: quality everyday premium wear — smart casual, tasteful neutrals, wearable real clothing. Natural polished makeup. Clean natural hairstyle — not editorial-styled.

Expression: warm confident presence — genuine smile or calm approachable energy. Real, alive, emotionally present. Not blank model stare, not performative beauty shot.

Color palette: soft white, warm beige, natural skin tones, light oak wood, gentle warm grey.

FORBIDDEN: Vogue editorial aesthetic, luxury mansion interior, grand European villa, fashion campaign energy, dramatic cinematic lighting, evening glamour, yacht or resort backgrounds, staged runway posing, extreme makeup, fantasy or cosplay elements.',
  NULL,
  'realistic',
  5,
  true,
  false,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  prompt        = EXCLUDED.prompt,
  category      = EXCLUDED.category,
  legacy_category = EXCLUDED.legacy_category,
  sort_order    = EXCLUDED.sort_order,
  active        = EXCLUDED.active,
  club_only     = EXCLUDED.club_only;

-- ── 2. ЧЁРНО-БЕЛЫЙ ПОРТРЕТ (bw_portrait) ─────────────────────────────────────
--
-- Prompt начинается с тега [TIMELESS PORTRAIT], который детектируется в
-- server/services/prompts.ts:
--   const isBWPortrait = /TIMELESS PORTRAIT|ЧЁРНО-БЕЛЫЙ|.../i.test(input.stylePrompt)
--                        || input.styleId === 'bw_portrait'   ← двойная защита
-- При совпадении buildPrompt() применяет bwPortraitBlock с директивой
--   «RENDER THE ENTIRE IMAGE IN PURE BLACK AND WHITE».
-- Без этого тега при fallback на bundle (пустой prompt) стиль генерировал
-- цветное изображение.

INSERT INTO styles (
  id, title, description, prompt,
  category, legacy_category, sort_order, active, club_only, preview_url
)
VALUES (
  'bw_portrait',
  'ЧЁРНО-БЕЛЫЙ ПОРТРЕТ',
  'Timeless monochrome — классический журнальный портрет в ч/б.',
  '[TIMELESS PORTRAIT]
Classic premium studio portrait in pure monochrome — timeless editorial quality.

BLACK AND WHITE ONLY — full grayscale output, zero color, no warm or cool tint whatsoever.

Setting: minimal clean studio or soft gradient grey background — simple, architectural, neutral.

Lighting: professional portrait lighting — soft directional key light with gentle fill, beautiful tonal range. Rich luminous skin tones rendered in grayscale. Clean contrast with depth — never harsh, never flat.

Fashion: simple elegant dark structured jacket or clean blouse, minimal jewelry, precise clean styling. No busy patterns, no bright colors visible.

Expression: strong, characterful, intelligent, composed. Timeless editorial portrait presence.

Camera feel: Vogue / Harper''s Bazaar premium monochrome editorial — classic, powerful, expensive.

FORBIDDEN: any color tint (warm or cool), sepia effect, horror aesthetic, noir darkness, heavy film grain, harsh dramatic shadows, cheap black-and-white filter effect, color leaks of any kind.',
  NULL,
  'realistic',
  160,
  true,
  false,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  prompt        = EXCLUDED.prompt,
  category      = EXCLUDED.category,
  legacy_category = EXCLUDED.legacy_category,
  sort_order    = EXCLUDED.sort_order,
  active        = EXCLUDED.active,
  club_only     = EXCLUDED.club_only;

-- ── Sanity check ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, title, active, length(prompt) AS prompt_len, left(prompt, 30) AS prompt_tag
      FROM styles
     WHERE id IN ('social_portrait', 'bw_portrait')
     ORDER BY sort_order
  LOOP
    RAISE NOTICE 'Migration 020: id=%-20s title=%-30s active=% prompt_len=% tag=%',
      r.id, r.title, r.active, r.prompt_len, r.prompt_tag;
  END LOOP;

  -- Проверяем, что prompt содержит нужные теги для детектирования в buildPrompt()
  IF NOT EXISTS (
    SELECT 1 FROM styles
     WHERE id = 'social_portrait'
       AND prompt LIKE '%PREMIUM INFLUENCER PORTRAIT%'
  ) THEN
    RAISE EXCEPTION 'Migration 020 FAILED: social_portrait prompt does not contain detection tag';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM styles
     WHERE id = 'bw_portrait'
       AND prompt LIKE '%TIMELESS PORTRAIT%'
  ) THEN
    RAISE EXCEPTION 'Migration 020 FAILED: bw_portrait prompt does not contain detection tag';
  END IF;

  RAISE NOTICE 'Migration 020: OK — both styles present with correct detection tags';
END $$;

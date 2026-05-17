-- Migration 011: Simplify to 3 categories (realistic / premium / kids)
-- Removes marketing category tabs, keeps luxury minimalism.
-- creative_studio deactivated (breaks luxury mood).
-- quiet_luxury (ЛЕТНИЙ ГОРОД) prompt reinforced for bright summer output.

-- 1. Deactivate ТВОРЧЕСКАЯ СТУДИЯ
UPDATE styles SET active = false WHERE id = 'creative_studio';

-- 2. Reassign categories for РЕАЛИЗМ tab
UPDATE styles SET category = NULL, legacy_category = 'realistic' WHERE id IN (
  'social_portrait',
  'business_elite',
  'old_money',
  'parisian_chic',
  'evening_glamour',
  'milano_style',
  'scandinavian_minimal',
  'golden_hour_glow',
  'elite_sport',
  'quiet_luxury',
  'bw_portrait'
);

-- 3. Reassign categories for ПРЕМИУМ tab
UPDATE styles SET category = NULL, legacy_category = 'premium' WHERE id IN (
  'intellectual_elegance',
  'new_york_power',
  'royal_bear',
  'luxe_editorial'
);

-- 4. Reinforce ЛЕТНИЙ ГОРОД prompt (bright summer, explicit FORBIDDEN for dark/neon)
UPDATE styles SET
  description = 'Лето, воздух, яркость — rooftop, оранж и бирюза, sunlight.',
  prompt = '[SUMMER ENERGY] Bright summer urban lifestyle — sun-drenched rooftop terrace with panoramic city views in warm afternoon sunlight, or vivid southern European street cafe with flowers and open sky, or bright beach promenade in tropical light. BRIGHT WARM DAYLIGHT: orange-golden, saturated, joyful, energetic — not dark, not moody, not neon. Color palette: warm orange, turquoise, coral, bright white, summer blue sky. Fashion: lightweight summer dress or casual chic in orange, white, turquoise, coral. Confident warm energy. FORBIDDEN: neon lights, dark backgrounds, cyberpunk or futuristic aesthetics, night scenes, moody low-key lighting.'
WHERE id = 'quiet_luxury';

-- 5. Sanity check
DO $$
DECLARE
  n_realistic INTEGER;
  n_premium   INTEGER;
  n_inactive  INTEGER;
BEGIN
  SELECT count(*) INTO n_realistic FROM styles WHERE legacy_category = 'realistic' AND active = true;
  SELECT count(*) INTO n_premium   FROM styles WHERE legacy_category = 'premium'   AND active = true;
  SELECT count(*) INTO n_inactive  FROM styles WHERE id = 'creative_studio' AND active = false;
  RAISE NOTICE 'Migration 011: realistic=%, premium=%, creative_studio inactive=%', n_realistic, n_premium, n_inactive;
END $$;

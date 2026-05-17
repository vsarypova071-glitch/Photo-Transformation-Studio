-- Migration 012: Fix sort_order to match desired card layout
-- РЕАЛИЗМ: portrait group first (соцсети, лидер, ч/б), then lifestyle, then nature/sport
-- ПРЕМИУМ: богиня first (hero), then монако, тропики, неоновый

-- РЕАЛИЗМ sort_order
UPDATE styles SET sort_order =  10 WHERE id = 'social_portrait';
UPDATE styles SET sort_order =  20 WHERE id = 'business_elite';
UPDATE styles SET sort_order =  30 WHERE id = 'bw_portrait';
UPDATE styles SET sort_order =  40 WHERE id = 'old_money';
UPDATE styles SET sort_order =  50 WHERE id = 'parisian_chic';
UPDATE styles SET sort_order =  60 WHERE id = 'evening_glamour';
UPDATE styles SET sort_order =  70 WHERE id = 'milano_style';
UPDATE styles SET sort_order =  80 WHERE id = 'scandinavian_minimal';
UPDATE styles SET sort_order =  90 WHERE id = 'quiet_luxury';
UPDATE styles SET sort_order = 100 WHERE id = 'golden_hour_glow';
UPDATE styles SET sort_order = 110 WHERE id = 'elite_sport';

-- ПРЕМИУМ sort_order
UPDATE styles SET sort_order = 200 WHERE id = 'intellectual_elegance';
UPDATE styles SET sort_order = 210 WHERE id = 'new_york_power';
UPDATE styles SET sort_order = 220 WHERE id = 'royal_bear';
UPDATE styles SET sort_order = 230 WHERE id = 'luxe_editorial';

-- Sanity check
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE 'Migration 012 — sort_order result:';
  FOR r IN SELECT id, sort_order FROM styles WHERE legacy_category IN ('realistic','premium') AND active = true ORDER BY sort_order LOOP
    RAISE NOTICE '  % → %', r.sort_order, r.id;
  END LOOP;
END $$;

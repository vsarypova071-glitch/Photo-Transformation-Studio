-- Migration 005: attach preview_url for the 5 kids premium styles.
--
-- ВАЖНО:
--   • НЕ трогает prompts (idempotent UPDATE только preview_url).
--   • НЕ трогает adult styles (фильтр по category='Детские').
--   • НЕ создаёт новых стилей.
--   • Идемпотентно: повторный запуск перезапишет тем же значением.
--
-- Условие: файлы должны лежать в public/style-previews/kids/<id>.png
-- и быть задеплоены в /var/www/ai-fotosessia.ru/public/style-previews/kids/.
-- Тогда nginx отдаёт их по same-origin URL '/style-previews/kids/<id>.png'.
-- Frontend (src/services/styles.ts:adapt) использует preview_url из БД,
-- если он непустой; иначе fallback на bundle.

UPDATE styles SET preview_url = '/style-previews/kids/kids_sport_champion.png'
  WHERE id = 'kids_sport_champion' AND category = 'Детские';

UPDATE styles SET preview_url = '/style-previews/kids/kids_cozy_childhood.png'
  WHERE id = 'kids_cozy_childhood' AND category = 'Детские';

UPDATE styles SET preview_url = '/style-previews/kids/kids_ballet.png'
  WHERE id = 'kids_ballet' AND category = 'Детские';

UPDATE styles SET preview_url = '/style-previews/kids/kids_savanna.png'
  WHERE id = 'kids_savanna' AND category = 'Детские';

UPDATE styles SET preview_url = '/style-previews/kids/kids_ice_grace.png'
  WHERE id = 'kids_ice_grace' AND category = 'Детские';

-- Sanity check
DO $$
DECLARE n_with_preview INTEGER;
BEGIN
  SELECT count(*) INTO n_with_preview
    FROM styles
   WHERE category = 'Детские' AND preview_url IS NOT NULL AND preview_url <> '';
  RAISE NOTICE 'Migration 005: kids styles with preview_url = %', n_with_preview;
END $$;

-- ============================================================================
-- ROLLBACK (вручную):
--   UPDATE styles SET preview_url = NULL WHERE category = 'Детские';
-- ============================================================================

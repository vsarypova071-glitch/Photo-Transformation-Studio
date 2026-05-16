-- Migration 010: Add ТВОРЧЕСКАЯ СТУДИЯ and ЧЁРНО-БЕЛЫЙ ПОРТРЕТ
-- Два новых стиля для закрытия визуальных gaps: creative/bohemian и timeless B&W.
-- IDs: creative_studio, bw_portrait

INSERT INTO styles (id, title, description, prompt, category, legacy_category, club_only, sort_order, active, preview_url)
VALUES (
  'creative_studio',
  'ТВОРЧЕСКАЯ СТУДИЯ',
  'Арт-лофт, богемность, тепло — premium creative aesthetic.',
  '[CREATIVE STUDIO] Warm premium artistic space — sun-filled artist''s loft or creative studio with tall windows flooding soft natural daylight onto natural wood floors and textured walls, original art canvases, ceramic objects, rich textiles, lush greenery, art books and beautiful objects. Warm golden window light — soft, creative, alive, inspiring. Elevated bohemian fashion: tailored wide-leg trousers in warm terracotta or dusty rose, quality silk blouse in emerald or cream, layered linen, artisan jewelry in warm gold or brass. Creative confident presence — expressive, intelligent, aesthetic, soulful. FORBIDDEN: dirty cheap industrial loft, dark moody basement, grungy urban decay, cheap studio, warehouse aesthetic. Color palette: warm beige, terracotta, emerald green, dusty pink, natural wood tones, warm soft daylight.',
  NULL,
  'realistic',
  false,
  150,
  true,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  prompt      = EXCLUDED.prompt,
  sort_order  = EXCLUDED.sort_order;

INSERT INTO styles (id, title, description, prompt, category, legacy_category, club_only, sort_order, active, preview_url)
VALUES (
  'bw_portrait',
  'ЧЁРНО-БЕЛЫЙ ПОРТРЕТ',
  'Timeless monochrome — классический журнальный портрет в ч/б.',
  '[TIMELESS PORTRAIT] Classic premium studio portrait in pure monochrome — minimal clean studio, professional portrait lighting with soft directional key light and gentle fill, beautiful timeless editorial composition. BLACK AND WHITE ONLY — full grayscale output, no color whatsoever, no warm or cool tint. Rich tonal range — luminous skin tones rendered in beautiful grayscale, clean contrast with depth. Fashion: simple elegant dark structured jacket or clean blouse, minimal jewelry, precise clean styling. Strong, characterful, intelligent, composed expression. Timeless editorial portrait — Vogue / Harper''s Bazaar monochrome editorial level. FORBIDDEN: horror aesthetic, noir darkness, heavy film grain, harsh shadows, sepia tint, cheap B&W filter effect, color leaks. This is a premium magazine monochrome portrait — classic, powerful, expensive.',
  NULL,
  'realistic',
  false,
  160,
  true,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  prompt      = EXCLUDED.prompt,
  sort_order  = EXCLUDED.sort_order;

-- Sanity check
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM styles WHERE id IN ('creative_studio', 'bw_portrait');
  RAISE NOTICE 'Migration 010: % / 2 new styles present', n;
END $$;

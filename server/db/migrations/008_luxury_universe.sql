-- Migration 008: upgrade 5 core luxury sub-styles with cinematic universe prompts.
-- Each style = one chapter of the РОСКОШЬ universe. Prompts include [CHAPTER] header,
-- specific luxury setting, directional lighting, fashion starting point, color palette.
-- IDs, categories, preview_url, sort_order, club_only — NOT changed.

-- 1. РОСКОШЬ (old_money) — Old Money Universe
UPDATE styles SET
  prompt = '[OLD MONEY] Grand European interior — tall windows with sheer curtains, parquet floors, antique furniture, pale walls with museum-quality art. She is at home here, not visiting. Soft natural light through high windows with warm golden undertones on ivory walls. Fashion: quiet luxury precision — wide-leg trousers in ivory or warm camel, fine cashmere blazer or silk blouse, minimal real jewelry without statement pieces. Realistic matte fabric texture, natural authentic folds, quality fabric weight. Shallow depth of field, off-center cinematic framing. Direct calm eye contact — ownership, not performance. Color palette: ivory, warm camel, aged gold, cognac, cream marble. Camera: Leica SL2, 75mm Summicron APO.'
WHERE id = 'old_money';

-- 2. ЛИДЕР (business_elite) — CEO Power Universe
UPDATE styles SET
  prompt = '[CEO POWER] Architectural glass tower — floor-to-ceiling windows with city skyline at dusk, clean geometric lines, premium minimal interior, polished stone or steel surfaces. She owns the room. Strong directional sculptural lighting — precise and powerful, like a spotlight on authority. Fashion: executive precision — sharp-tailored power suit or structured blazer in charcoal, deep navy or slate, luxury minimal accessories, refined footwear. Realistic wool texture, visible stitching, matte finish. Direct powerful eye contact, commanding confidence without aggression. Color palette: charcoal grey, deep navy, steel, crisp white, black. Camera: Canon EOS R5, 85mm f/1.2.'
WHERE id = 'business_elite';

-- 3. МИР БУДУЩЕГО (quiet_luxury) — Future Luxury Universe
UPDATE styles SET
  prompt = '[FUTURE LUXURY] Avant-garde architectural interior — sculptural white-and-glass museum space, dramatic geometric lighting installation, high-design gallery or luxury hotel lobby. The future is already here. Dramatic cool neon-blue or silver-white architectural lighting with deep shadow architecture. Fashion: structural luxury minimalism — clean geometric silhouette in white, silver, deep midnight or ice blue, premium technical fabric. Realistic matte technical fabric texture, precise construction, sharp tailoring. Calm visionary presence, direct gaze — she is already where others are going. Color palette: deep midnight, silver white, ice blue, violet accent, architectural shadow. Camera: Sony A7R V, 50mm f/1.2.'
WHERE id = 'quiet_luxury';

-- 4. ЗАТЕРЯННЫЙ МИР (luxury_resort) — Luxury Explorer Universe
UPDATE styles SET
  prompt = '[LUXURY EXPLORER] Ancient temple ruins half-reclaimed by lush jungle, mystical forest with golden shafts of light through dense canopy, or dramatic volcanic landscape at golden hour. She has been everywhere worth going. Natural dramatic light — warm amber shafts, deep shadow pockets, atmospheric cinematic depth. Fashion: elevated expedition — structured waxed field jacket in khaki or olive, quality canvas coat, leather accessories. Realistic matte waxed canvas and leather texture, authentic weathered character. Adventurous confident presence — explorer, not tourist. Color palette: amber, jungle green, deep earth, shadow brown, ancient gold. Camera: Sony A7R V, 85mm f/1.4.'
WHERE id = 'luxury_resort';

-- 5. РОМАНТИКА (parisian_chic) — Sensual Paris Universe
UPDATE styles SET
  prompt = '[SENSUAL PARIS] An intimate Paris moment — private haussmann apartment with tall windows at dusk, warm-lit brasserie with golden interior glow, or garden terrace as the evening turns blue. The most interesting woman in the most beautiful city. Soft intimate lighting — warm candle glow, golden hour through glass, gentle diffused indoor warmth. Fashion: effortlessly feminine — flowing silk dress, fine knit with beautiful natural drape, delicate fabric in blush, ivory, dusty rose or champagne. Realistic silk and fine wool texture, natural fabric movement, soft authentic folds. Direct eye contact — knowing, present, magnetic. Color palette: blush, champagne, ivory, dusty rose, warm gold. Camera: Leica Q3, 28mm, film-like warmth.'
WHERE id = 'parisian_chic';

-- Sanity check
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM styles
  WHERE id IN ('old_money','business_elite','quiet_luxury','luxury_resort','parisian_chic')
    AND prompt LIKE '[%'
    AND LENGTH(prompt) > 200;
  RAISE NOTICE 'Migration 008: % / 5 luxury universe prompts updated', n;
END $$;

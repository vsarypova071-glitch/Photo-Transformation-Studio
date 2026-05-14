-- Migration 007: rename all 13 adult styles to Russian marketing names,
-- update descriptions and prompts for premium cinematic realism.
-- IDs, categories, preview_url, club_only — NOT changed.
-- Sort order updated to match new display priority.

UPDATE styles SET
  title       = 'РОСКОШЬ',
  description = 'Роскошный premium-образ в стиле quiet luxury, дорогие интерьеры, элегантность, статус и мягкий cinematic свет.',
  prompt      = 'Quiet luxury interior portrait. Soft diffused natural window light with warm golden undertones. Premium fashion: tailored cashmere coat or silk blouse in ivory, warm camel or champagne tones. Realistic fabric texture — natural matte finish, authentic folds, quality weave. Relaxed aristocratic pose near classic furniture or architectural detail. Shot on Sony A7R V, 85mm f/1.4. Shallow depth of field, atmospheric cinematic depth. Natural skin texture, subtle imperfections. Color palette: ivory, warm camel, cognac, champagne, soft beige.',
  sort_order  = 10
WHERE id = 'old_money';

UPDATE styles SET
  title       = 'ЛИДЕР',
  description = 'Сильный деловой образ с атмосферой власти, уверенности и современного успеха.',
  prompt      = 'Executive power portrait — authority, confidence, modern success. Directional professional lighting with natural cinematic shadows. Premium fashion: precision-tailored power suit or structured blazer in charcoal grey, deep navy or slate. Realistic wool texture — visible stitching, natural clothing fit, matte fabric finish. Confident commanding posture in a modern architectural setting. Shot on Canon EOS R5, 85mm f/1.2. Authentic portrait quality — real skin texture, natural expression. Color palette: charcoal, deep navy, steel grey, crisp white.',
  sort_order  = 20
WHERE id = 'business_elite';

UPDATE styles SET
  title       = 'ДИКАЯ ПРИРОДА',
  description = 'Атмосфера свободы, природы и приключений. Лес, горы, натуральные ткани и естественный свет.',
  prompt      = 'Cinematic outdoor portrait in wild nature — forest, mountain or open landscape. Rich natural daylight, golden hour warmth or soft overcast. Premium outdoor fashion: tailored wool coat, quality knit sweater or leather jacket in earthy forest tones. Realistic wool and leather texture — natural fabric weight, authentic outdoor character. Strong natural expression — free, alive, grounded. Shot on Nikon Z9, 85mm f/1.4, natural available light only. Atmospheric depth, cinematic outdoor color grading. Color palette: forest green, cognac brown, warm ivory, deep earth, moss.',
  sort_order  = 30
WHERE id = 'golden_hour_glow';

UPDATE styles SET
  title       = 'ЗИМНЯЯ СКАЗКА',
  description = 'Снежная эстетика, холодный свет, зимняя элегантность и магическая атмосфера.',
  prompt      = 'Cinematic winter portrait with magical snow atmosphere. Soft cold natural light — overcast winter sky or gentle indoor warmth. Elegant winter fashion: long cashmere overcoat, fine knit turtleneck in white, pearl grey, ice blue or silver. Realistic cashmere and wool texture — natural fabric weight, subtle authentic folds, quality winter wear. Serene elegant expression, quiet inner strength. Shot on Hasselblad X2D, 90mm. Shallow depth of field, atmospheric winter depth. Natural skin, real hair. Color palette: white, pearl grey, ice blue, silver, champagne.',
  sort_order  = 40
WHERE id = 'scandinavian_minimal';

UPDATE styles SET
  title       = 'СКОРОСТЬ',
  description = 'Динамичный cinematic-образ с энергией движения, ночного города и адреналина.',
  prompt      = 'Cinematic night city portrait with energy and adrenaline. Dark urban backdrop — bokeh streetlights, wet asphalt reflections, neon glow. Contemporary urban fashion: tailored dark coat, sleek leather jacket or structured blazer in black, deep navy or midnight. Realistic leather and fabric texture — matte finish, natural folds, authentic urban wear. Dynamic confident posture, alive and driven. Shot on Nikon Z9, 50mm f/1.2, available night light. Atmospheric cinematic depth, no CGI glow. Color palette: black, deep navy, electric neon blue, wet asphalt silver.',
  sort_order  = 50
WHERE id = 'new_york_power';

UPDATE styles SET
  title       = 'РОКОВАЯ',
  description = 'Драматичный женственный образ с атмосферой кино, загадочности и luxury glamour.',
  prompt      = 'Cinematic portrait with film noir elegance — mysterious, powerful, magnetic. Dramatic low-key lighting with deep sculpted shadows and precise cinematic highlights. Stunning evening fashion: sleek evening dress or luxurious structured ensemble in black, deep burgundy or midnight blue. Realistic silk and velvet texture — natural fabric drape, elegant folds, authentic weight. Mysterious confident expression. Shot on Hasselblad H6D, 80mm. Authentic photography — real skin, no overprocessed beauty. Color palette: black, deep burgundy, midnight blue, gold accent.',
  sort_order  = 60
WHERE id = 'evening_glamour';

UPDATE styles SET
  title       = 'ЗАТЕРЯННЫЙ МИР',
  description = 'Приключенческий стиль с атмосферой древнего мира, джунглей и cinematic expedition.',
  prompt      = 'Cinematic expedition portrait in lush ancient landscape — jungle, overgrown ruins or mystical forest. Dramatic natural light filtering through dense canopy. Sophisticated expedition fashion: structured field jacket, quality waxed canvas coat or tailored utility wear in khaki, forest green or deep earth. Realistic waxed canvas and cotton texture — natural fabric character, authentic outdoor wear. Adventurous confident expression — explorer energy. Shot on Sony A7R V, 85mm f/1.4. Atmospheric cinematic depth, real photography quality. Color palette: jungle green, khaki, amber, deep earth, shadow brown.',
  sort_order  = 70
WHERE id = 'luxury_resort';

UPDATE styles SET
  title       = 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
  description = 'Эстетика путешествий, свободы и красивых мест по всему миру.',
  prompt      = 'Cinematic travel portrait — authentic fashion photography in beautiful world destinations. European architecture, Mediterranean coastline or exotic landscape backdrop. Elevated travel fashion: tailored coat, quality linen or cashmere ensemble in terracotta, warm sand, ocean blue or olive. Realistic fabric texture — natural folds, authentic travel wear character. Effortlessly stylish, candid confident pose. Shot on Leica Q3, 28mm, natural available light. Atmospheric outdoor depth, cinematic travel color grading. Color palette: terracotta, warm sand, ocean blue, linen, sage olive.',
  sort_order  = 80
WHERE id = 'milano_style';

UPDATE styles SET
  title       = 'РОМАНТИКА',
  description = 'Теплый романтический образ с мягким светом, нежностью и атмосферой love story.',
  prompt      = 'Cinematic romantic portrait — warmth, intimacy, love story atmosphere. Soft golden diffused light — window light or gentle outdoor warmth. Romantic feminine fashion: flowing midi dress or delicate blouse with fine fabric drape in blush, rose, ivory or champagne. Realistic silk and chiffon texture — natural fabric movement, soft elegant folds. Gentle warm expression, emotionally present. Shot on Canon R5, 85mm f/1.2. Authentic photography — real skin, subtle warmth, film-like color grading. Color palette: blush rose, ivory, champagne, warm peach, soft gold.',
  sort_order  = 90
WHERE id = 'parisian_chic';

UPDATE styles SET
  title       = 'МИР БУДУЩЕГО',
  description = 'Футуристичный стиль с неоновым светом, технологичной атмосферой и sci-fi эстетикой.',
  prompt      = 'Cinematic sci-fi portrait with futuristic atmosphere. Dramatic neon and violet-blue lighting — architectural setting with technological depth. Forward contemporary fashion: structured technical ensemble, clean geometric silhouette in white, silver, deep midnight or ice blue. Realistic technical fabric texture — matte finish, precise construction, authentic futuristic wear. Calm powerful presence — evolved, visionary. Shot on Sony A7R V, 50mm f/1.2. Real photography quality — authentic skin, no CGI rendering. Color palette: deep midnight, neon blue, silver white, violet accent, dark steel.',
  sort_order  = 100
WHERE id = 'quiet_luxury';

UPDATE styles SET
  title       = 'ВЫСОКАЯ МОДА',
  description = 'Fashion editorial в стиле глянцевого журнала и luxury fashion photography.',
  prompt      = 'High-end fashion editorial portrait — luxury magazine quality, Vogue / Harper''s Bazaar aesthetic. Dramatic professional studio lighting with cinematic sculpted depth. Premium editorial fashion: couture-level silhouette in exceptional fabric — structured crepe, heavy silk or tailored precision. Realistic fabric texture — matte surface, visible construction detail, authentic fashion photography quality. Dynamic powerful editorial pose. Shot on Phase One IQ4, Broncolor studio. Real skin texture, no artificial beauty filter. Color palette: bold fashion statement — deep black, sculptural neutral or high-contrast editorial tones.',
  sort_order  = 110
WHERE id = 'luxe_editorial';

UPDATE styles SET
  title       = 'БОГИНЯ',
  description = 'Величественный женственный образ с мягким сиянием, античной эстетикой и атмосферой силы.',
  prompt      = 'Cinematic portrait with timeless feminine power — goddess aesthetic. Soft luminous light — gentle diffused studio glow or natural daylight through sheer fabric. Flowing elegant fashion: draped silk dress, structured gown or refined ensemble in ivory, soft gold, sage or warm earth. Realistic silk and chiffon texture — natural drape, flowing folds, elegant fabric weight. Serene powerful expression — inner strength, quiet magnetism. Shot on Sony A1, 85mm f/1.4. Shallow depth of field, atmospheric glow. Authentic photography quality — natural skin, real hair. Color palette: ivory white, warm gold, sage green, luminous cream.',
  sort_order  = 120
WHERE id = 'intellectual_elegance';

UPDATE styles SET
  title       = 'ЦАРСКАЯ ОХОТА',
  description = 'Аристократический outdoor-стиль с лесной атмосферой, статусом и cinematic realism.',
  prompt      = 'Cinematic aristocratic outdoor portrait — royal hunting aesthetic, old European tradition. Dramatic natural light through ancient forest trees, golden hour or soft overcast. Classic aristocratic hunting fashion: structured waxed jacket, quality tweed coat or hunting blazer in forest green, cognac or deep brown. Realistic tweed and waxed canvas texture — authentic fabric character, natural outdoor wear, visible fabric detail. Powerful aristocratic presence, commanding and grounded. Shot on Leica SL2, 90mm Summicron, natural light. Authentic photography — real skin, no over-retouching. Color palette: deep forest green, cognac, dark brown, golden amber, autumn earth.',
  sort_order  = 130
WHERE id = 'royal_bear';

-- Sanity check
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM styles WHERE title IN (
    'РОСКОШЬ','ЛИДЕР','ДИКАЯ ПРИРОДА','ЗИМНЯЯ СКАЗКА','СКОРОСТЬ',
    'РОКОВАЯ','ЗАТЕРЯННЫЙ МИР','БОЛЬШОЕ ПУТЕШЕСТВИЕ','РОМАНТИКА',
    'МИР БУДУЩЕГО','ВЫСОКАЯ МОДА','БОГИНЯ','ЦАРСКАЯ ОХОТА'
  );
  RAISE NOTICE 'Migration 007: updated % / 13 adult styles', n;
END $$;

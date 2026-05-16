-- Migration 009: Visual Diversity Redesign
-- Цель: максимально разные стили по цвету, свету, локации, эмоции.
-- Убираем dark cinematic gloom. Добавляем свет, воздух, яркие цвета.
-- IDs не меняются — меняются title, description, prompt, sort_order.

-- 1. ЛИДЕР (business_elite) — CEO Daylight: clean, bright, powerful
UPDATE styles SET
  title       = 'ЛИДЕР',
  description = 'CEO, успех, статус — чистый дорогой офисный образ.',
  prompt      = '[CEO DAYLIGHT] Modern architectural glass tower — bright clean daylight through floor-to-ceiling windows, sparkling city skyline in background, polished steel and glass premium interior. Clean professional natural light — crisp, even, powerful. Fashion: precision power suit in deep navy or charcoal, luxury blazer in steel or crisp white, refined accessories. Confident commanding posture, direct professional gaze. FORBIDDEN: warm sunset tones, noir shadows, dramatic contrast, moody atmosphere. Color palette: deep navy, steel blue, crisp white, graphite, clean bright light.',
  sort_order  = 10
WHERE id = 'business_elite';

-- 2. МОНАКО (new_york_power) — Monaco Lifestyle: daytime yachts, blue water, sun
UPDATE styles SET
  title       = 'МОНАКО',
  description = 'Яхты, Монако, дорогая динамичная жизнь.',
  prompt      = '[MONACO LIFESTYLE] Monaco harbor at bright Mediterranean midday or warm golden afternoon — luxury superyachts on sparkling deep blue water, elegant cream Belle Époque buildings, premium promenade with palms. Bright Mediterranean daylight on chrome, white surfaces and water. Nautical luxury fashion: white linen blazer, premium silk dress or elegant casual in white, warm gold, navy. Relaxed confident luxury lifestyle, effortless status. FORBIDDEN: dark nightlife energy, nightclub aesthetic, aggressive neon. Color palette: deep blue sea, pure white, warm gold, chrome, Mediterranean sunlight.',
  sort_order  = 20
WHERE id = 'new_york_power';

-- 3. БОГИНЯ (intellectual_elegance) — Divine Cinematic: epic sea cliffs, golden power
UPDATE styles SET
  title       = 'БОГИНЯ',
  description = 'Эпичная женская сила — море, скалы, закат, cinematic.',
  prompt      = '[DIVINE CINEMATIC] Epic Mediterranean setting — dramatic coastal cliff overlooking endless deep blue ocean at golden hour, luxury villa terrace over shimmering sea, or coastal rocks with warm sunset. Powerful cinematic sunlight — warm gold, glowing skin, warm wind through hair and fabric. Flowing sculptural silk dress in white, ivory or warm gold — couture silhouette, natural wind movement. Strong, commanding, silent divine presence. THIS IS NOT ROMANCE — this is power, strength, epic feminine energy. Color palette: white, ocean blue, golden sunset, glowing skin, warm amber.',
  sort_order  = 30
WHERE id = 'intellectual_elegance';

-- 4. РОСКОШЬ (old_money) — Luxury Daylight: bright warm European villa interior
UPDATE styles SET
  title       = 'РОСКОШЬ',
  description = 'Тепло, дорого, спокойно — luxury lifestyle в европейском свете.',
  prompt      = '[LUXURY DAYLIGHT] Grand European villa or premium hotel interior — sun-filled room with tall sheer curtains billowing in warm daylight, cream marble surfaces, fresh white flowers, golden light flooding the space. Warm bright expensive daytime atmosphere — no darkness, no noir. Fashion: quiet luxury — tailored cashmere coat in ivory, silk blouse in warm cream, wide-leg trousers in champagne or camel. Natural aristocratic presence, warm relaxed elegance. FORBIDDEN: dark noir lighting, black void backgrounds, heavy dramatic contrast. Color palette: ivory, warm camel, cream marble, champagne, soft gold, warm daylight.',
  sort_order  = 40
WHERE id = 'old_money';

-- 5. РОМАНТИКА (parisian_chic) — Summer Happiness: flowers, cafe, light, joy
UPDATE styles SET
  title       = 'РОМАНТИКА',
  description = 'Красивая жизнь, цветы, лето — Pinterest luxury lifestyle.',
  prompt      = '[SUMMER HAPPINESS] Romantic European summer scene — blooming terrace cafe with fresh flowers everywhere and warm golden sun, sunlit Parisian street with dappled light through trees, or beautiful balcony breakfast in bright morning warmth. Golden hour airy soft light — warm, glowing, joyful, alive. Feminine summer fashion: floral midi dress, linen summer set or blouse in soft pink, cream, champagne, blush. Happy warm authentic expression, effortless feminine energy. FORBIDDEN: rain, darkness, noir, moody atmosphere, cold tones. Color palette: cream, soft pink, champagne, warm sunlight, blush rose, flower yellow.',
  sort_order  = 50
WHERE id = 'parisian_chic';

-- 6. РОКОВАЯ (evening_glamour) — Luxury Evening Glamour: warm restaurant, premium, sensual
UPDATE styles SET
  title       = 'РОКОВАЯ',
  description = 'Дорогая элегантность вечера — luxury restaurant, premium glamour.',
  prompt      = '[LUXURY EVENING GLAMOUR] Elegant luxury restaurant or private cocktail lounge — warm amber chandeliers casting golden light, gold accents and velvet details, beautiful warm premium evening atmosphere. Luxury evening light — glowing, warm, expensive, sensual — NOT cold noir, NOT horror darkness. Stunning evening dress in deep black with delicate gold jewelry, rich wine velvet, or midnight blue. Confident, alluring, sophisticated presence. FORBIDDEN: horror noir, black void backgrounds, cold darkness, cheap nightclub. Color palette: deep black, warm gold, dark wine, amber evening glow, soft luxury warm light.',
  sort_order  = 60
WHERE id = 'evening_glamour';

-- 7. ОБРАЗ ДЛЯ СОЦСЕТЕЙ (social_portrait) — Premium Influencer: bright, clean, natural
UPDATE styles SET
  title       = 'ОБРАЗ ДЛЯ СОЦСЕТЕЙ',
  description = 'Premium influencer aesthetic — естественный, чистый, дорогой.',
  prompt      = '[PREMIUM INFLUENCER PORTRAIT] Sun-lit modern interior — Scandinavian apartment with white walls and warm oak, soft beautiful window light on clean surfaces. Or stylish city cafe with natural bright daylight and clean neutral tones. Clean bright natural atmosphere — no dramatic shadows, no luxury editorial. Everyday premium styling: quality linen blazer, clean white shirt, smart casual in soft warm neutrals. Warm confident approachable expression. Color palette: clean white, warm neutral grey, soft beige, natural skin tones, soft light.',
  sort_order  = 70
WHERE id = 'social_portrait';

-- 8. ТРОПИКИ (royal_bear) — Tropical Luxury: turquoise, beach, palms, premium resort
UPDATE styles SET
  title       = 'ТРОПИКИ',
  description = 'Luxury vacation — пляж, бирюза, tropical villa, ocean.',
  prompt      = '[TROPICAL LUXURY] Private tropical luxury resort — pristine white sand beach with crystal turquoise ocean, luxury pool villa surrounded by bougainvillea and exotic palms, or overwater bungalow deck over calm turquoise lagoon. Bright tropical sunlight — saturated, warm, beautiful, vibrant. Luxury resort fashion: flowing silk resort dress, elegant linen coverup or premium resort set in cyan, tropical white, coral or hibiscus pink. Beautiful, relaxed, premium vacation energy. FORBIDDEN: cheap tourism, budget resort, wildlife fantasy animals. Color palette: cyan ocean, tropical green, pink flowers, coral, warm white.',
  sort_order  = 80
WHERE id = 'royal_bear';

-- 9. БОЛЬШОЕ ПУТЕШЕСТВИЕ (milano_style) — Travel Luxury: Italian sun, architecture, color
UPDATE styles SET
  title       = 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
  description = 'Luxury travel lifestyle — Италия, Испания, Средиземноморье.',
  prompt      = '[TRAVEL LUXURY] Iconic European architecture in warm bright daylight — Italian piazza with terracotta facades and warm sun, Andalusian streets with whitewashed walls and bougainvillea, Santorini blue domes over white houses, French Riviera promenade with palms. Bright Mediterranean daylight — warm, saturated, alive, beautiful. Elevated travel fashion: tailored linen coat, quality summer dress or cashmere in terracotta, warm sand or ocean blue. Effortlessly stylish candid energy. FORBIDDEN: forest, snow, fog, dark atmosphere. Color palette: terracotta orange, ocean blue, warm sand, Italian stone, bright sunlight.',
  sort_order  = 90
WHERE id = 'milano_style';

-- 10. ДИКАЯ ПРИРОДА (golden_hour_glow) — Fresh Wilderness: Nordic, misty, free, no animals
UPDATE styles SET
  title       = 'ДИКАЯ ПРИРОДА',
  description = 'Свобода, свежесть, северная эстетика — лес, горы, природа.',
  prompt      = '[FRESH WILDERNESS] Nordic landscape at its most beautiful — misty mountain lake with morning reflections, open highland with dramatic cloud shadows, or ancient green valley in fresh morning light. Clean cool natural atmosphere. Overcast soft daylight or golden morning light — cool, fresh, airy, breathing, alive. Quality outdoor fashion: tailored wool coat, quality knit in forest green, natural brown, fog grey or warm ivory. Strong natural expression — free, alive, grounded. FORBIDDEN: fantasy wolves, magical animals, dark fantasy creatures. Color palette: forest green, fog grey, natural brown, moss, morning mist light.',
  sort_order  = 100
WHERE id = 'golden_hour_glow';

-- 11. АЛЬПИЙСКАЯ СКАЗКА (scandinavian_minimal) — Alpine Luxury: chalet, bright winter, cozy
UPDATE styles SET
  title       = 'АЛЬПИЙСКАЯ СКАЗКА',
  description = 'Winter luxury — шале, Альпы, снег, тепло и уют.',
  prompt      = '[ALPINE LUXURY] Swiss Alps luxury chalet interior — warm wooden beams and panels, panoramic glass window view of snow-covered mountains in bright winter daylight, cozy premium textiles, warm fireplace amber glow. Bright winter daylight through large glass with warm interior contrast — light, warm, expensive. Premium winter fashion: oversized cashmere sweater, luxury knit in snow white, warm camel or ice blue, elegant winter coat. Warm cozy expensive winter lifestyle. Color palette: snow white, ice blue, warm wood amber, soft camel, gentle firelight.',
  sort_order  = 110
WHERE id = 'scandinavian_minimal';

-- 12. СПОРТ (elite_sport) — Premium Athletic: luxury gym, bright daylight, power
UPDATE styles SET
  title       = 'СПОРТ',
  description = 'Athletic lifestyle — premium sport editorial, энергия, сила.',
  prompt      = '[PREMIUM ATHLETIC] Luxury panoramic gym with floor-to-ceiling windows and bright city daylight, professional tennis club in open air with natural sunlight, or premium marble wellness studio flooded with clean natural light. Bright clean athletic daylight — crisp, energetic, modern. Premium activewear — luxury sport brand in white, carbon grey, or matte black. Athletic powerful expression, confident dynamic energy. FORBIDDEN: cheap fitness club, neon gym lighting, selfie vibe, cheap sportswear. Color palette: white, carbon grey, matte black, bright clean light.',
  sort_order  = 120
WHERE id = 'elite_sport';

-- 13. ЛЕТНИЙ ГОРОД (quiet_luxury) — Summer Energy: rooftop, bright colors, sun, joy
UPDATE styles SET
  title       = 'ЛЕТНИЙ ГОРОД',
  description = 'Лето, энергия, яркость — rooftop, летние улицы, beach cafe.',
  prompt      = '[SUMMER ENERGY] Vibrant summer urban scene — sun-drenched rooftop terrace with sweeping city views in warm afternoon sun, colorful southern European street cafe with bright umbrella shade and flowers, or beach promenade in vivid tropical light. Bold warm bright summer sunlight — orange, saturated, energetic, joyful. Stylish summer fashion: flowing summer dress, lightweight blazer or casual chic in orange, turquoise, bright coral, yellow or white. Warm happy confident energy. Color palette: warm orange, turquoise, bright yellow, coral, vibrant white, summer blue sky.',
  sort_order  = 130
WHERE id = 'quiet_luxury';

-- 14. НЕОНОВЫЙ ГОРОД (luxe_editorial) — Cyber Luxury: architectural neon, Seoul/Dubai premium
UPDATE styles SET
  title       = 'НЕОНОВЫЙ ГОРОД',
  description = 'Futuristic luxury — архитектурный неон, cyber premium.',
  prompt      = '[CYBER LUXURY] Futuristic luxury architecture at its most elegant — Seoul or Dubai premium glass-and-chrome hotel lobby with controlled architectural neon accents, luxury rooftop bar with glossy city reflections at night, or high-design architectural interior with geometric neon lighting installation. Cool architectural neon — cyan, chrome, subtle violet — refined and selective, not overwhelming, not gaming. Structural fashion: geometric silhouette in chrome white, ice blue, or deep midnight with metallic accent detail. Calm, elevated, futuristic presence. FORBIDDEN: gamer aesthetic, cheap cyberpunk, latex, neon overload. Color palette: cyan, chrome, violet accent, architectural darkness, glossy reflections.',
  sort_order  = 140
WHERE id = 'luxe_editorial';

-- Sanity check
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM styles WHERE title IN (
    'ЛИДЕР','МОНАКО','БОГИНЯ','РОСКОШЬ','РОМАНТИКА',
    'РОКОВАЯ','ОБРАЗ ДЛЯ СОЦСЕТЕЙ','ТРОПИКИ','БОЛЬШОЕ ПУТЕШЕСТВИЕ',
    'ДИКАЯ ПРИРОДА','АЛЬПИЙСКАЯ СКАЗКА','СПОРТ','ЛЕТНИЙ ГОРОД','НЕОНОВЫЙ ГОРОД'
  );
  RAISE NOTICE 'Migration 009: updated % / 14 adult styles', n;
END $$;

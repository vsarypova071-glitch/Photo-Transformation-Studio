-- Migration 003: seed 13 styles from src/lib/constants.ts into the styles table.
-- Идемпотентно: ON CONFLICT DO NOTHING — повторный запуск не дублирует и не перетирает.
-- Если нужно обновить существующий стиль — делать вручную UPDATE или через будущий админ-API.
--
-- Назначение sort_order — порядок отображения, заданный в src/lib/constants.ts:REALISTIC_ORDER.
-- category (новые маркетинговые: Instagram/Tinder/Business/...) пока NULL — заполняется куратором.

INSERT INTO styles (id, title, description, prompt, legacy_category, sort_order, active, club_only, preview_url) VALUES
  ('business_elite',        'Business Elite',         'Деловой портрет уровня Forbes',
   'Executive portrait photography. Clean professional lighting. Premium tailored business attire. Confident powerful stance. Modern office or neutral background. Canon EOS R5, 85mm f/1.2. Forbes cover quality.',
   'realistic',  10, true, false, NULL),

  ('old_money',             'Old Money',              'Тихая роскошь старых денег',
   'Old money aesthetic portrait. Soft natural light in elegant interior. Classic understated luxury clothing (Ralph Lauren, Brunello Cucinelli style). Relaxed aristocratic pose. Film-like color grading. Hasselblad X2D quality.',
   'realistic',  20, true, false, NULL),

  ('new_york_power',        'New York Power',         'Мощный городской образ Нью-Йорка',
   'New York power dressing portrait. Urban sophisticated backdrop. Sharp tailored power suit or structured dress. Confident commanding pose. Dynamic city lighting. Nikon Z9, 70-200mm f/2.8. WSJ Magazine style.',
   'realistic',  30, true, false, NULL),

  ('evening_glamour',       'Evening Glamour',        'Роскошный вечерний гламур',
   'Evening glamour portrait. Sophisticated low-key lighting with sparkle. Stunning evening gown or cocktail dress. Elegant posed shot. Jewelry catching light beautifully. Hasselblad H6D. Red carpet quality photography.',
   'realistic',  40, true, false, NULL),

  ('luxe_editorial',        'Luxury Editorial',       'Фотосессия как в модном журнале',
   'High-end fashion editorial photography. Dramatic studio lighting with soft shadows. Luxury designer clothing, unique textures. Dynamic confident pose. Shot on Phase One IQ4, Broncolor lighting. Harper''s Bazaar quality.',
   'realistic',  50, true, false, NULL),

  ('intellectual_elegance', 'Intellectual Elegance',  'Стиль европейской классики',
   'Photorealistic European elegance portrait. Soft golden hour lighting. Classic tailored outfit in muted tones. Thoughtful pose with natural expression. Professional fashion photography. Leica SL2, 50mm Summilux. Vogue Italia aesthetic.',
   'realistic',  60, true, false, NULL),

  ('quiet_luxury',          'Quiet Luxury',           'Элегантный премиальный образ',
   'Ultra photorealistic portrait photography. Style: Quiet Luxury intellectual minimalism. Natural soft window light, shallow depth of field. Designer neutral-tone clothing (cashmere, silk). Candid elegant pose. Shot on Sony A7R IV, 85mm f/1.4 lens. Magazine editorial quality.',
   'realistic',  70, true, false, NULL),

  ('milano_style',          'Milano Elegance',        'Итальянская элегантная фотосессия',
   'Milanese street style fashion photography. Beautiful Italian architecture background. Chic designer outfit with bold accessories. Effortlessly stylish pose. Warm Mediterranean light. Sony A1, Zeiss Batis 85mm.',
   'realistic',  80, true, false, NULL),

  ('parisian_chic',         'Parisian Chic',          'Стильный образ в духе Парижа',
   'Parisian effortless chic portrait. Soft diffused daylight. Classic French style clothing (Chanel, Dior inspired). Natural relaxed pose at café or street. Film photography aesthetic. Contax 645, Portra 400 look.',
   'realistic',  90, true, false, NULL),

  ('scandinavian_minimal',  'Scandinavian Minimal',   'Минималистичный скандинавский портрет',
   'Scandinavian minimalist portrait. Clean white and neutral tones. Simple elegant clothing in quality fabrics. Serene contemplative expression. Soft overcast lighting. Fujifilm GFX 100S. Kinfolk magazine aesthetic.',
   'realistic', 100, true, false, NULL),

  ('golden_hour_glow',      'Golden Hour Glow',       'Тёплый романтический портрет',
   'Golden hour portrait photography. Warm backlit sun creating rim light. Flowing elegant outfit in warm tones. Dreamy romantic atmosphere. Natural outdoor setting. Canon R5, 135mm f/1.8. Instagram influencer quality.',
   'realistic', 110, true, false,
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=800'),

  ('luxury_resort',         'Luxury Resort',          'Роскошный курортный образ',
   'Luxury resort lifestyle portrait. Bright natural light, tropical or coastal setting. Elegant resort wear or summer couture. Relaxed sophisticated pose. Vibrant but refined colors. Sony A7 IV, Zeiss 55mm f/1.8Jean.',
   'realistic', 120, true, false, NULL),

  ('royal_bear',            'Royal Presence',         'Величественный образ королевской власти',
   'Majestic portrait with polar bear. Photorealistic cinematic lighting. Luxurious winter couture. Powerful protective symbolism. Dramatic composition. High-end fantasy fashion photography.',
   'wild',      200, true, false, NULL)
ON CONFLICT (id) DO NOTHING;

-- Sanity:
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM styles;
  RAISE NOTICE 'Migration 003: total styles in DB = %', n;
END $$;

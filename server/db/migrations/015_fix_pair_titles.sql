-- Migration 015: Fix pair style display titles and descriptions
-- Only couple_love_story needs a title change (LOVE STORY → ИСТОРИЯ ЛЮБВИ).
-- All 5 pair styles get updated Russian descriptions.

UPDATE styles SET
  title       = 'ИСТОРИЯ ЛЮБВИ',
  description = 'Романтичная фотосессия для пары с теплом, близостью и красивой эмоцией.'
WHERE id = 'couple_love_story';

UPDATE styles SET
  description = 'Нежный кадр мамы и ребёнка: любовь, мягкий свет и семейное тепло.'
WHERE id = 'mother_child';

UPDATE styles SET
  description = 'Тёплая фотосессия папы и ребёнка: радость, защита и настоящая эмоция.'
WHERE id = 'father_child';

UPDATE styles SET
  description = 'Живая съёмка для друзей: смех, энергия, настоящая связь и стильный кадр.'
WHERE id = 'best_friends';

UPDATE styles SET
  description = 'Статусный деловой портрет для партнёров, команды или совместного бренда.'
WHERE id = 'business_duo';

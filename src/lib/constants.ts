import { PlanType, Style, Package } from '../types';

import roskoshImg from '@/assets/styles/roskosh.png';
import liderImg from '@/assets/styles/leader.png';
import dikayaPrirodaImg from '@/assets/styles/wild_nature.png';
import zimnyayaSkazkaImg from '@/assets/styles/alpine_fairytale.png';
import skorostImg from '@/assets/styles/monaco.png';
import rokovayaImg from '@/assets/styles/femme_fatale.png';
import eliteSportImg from '@/assets/styles/sport.png';
import bolshoePatheshestvieImg from '@/assets/styles/great_journey.png';
import romantikaImg from '@/assets/styles/romance.png';
import mirBudushchegoImg from '@/assets/styles/summer_city.png';
import vysokayaModaImg from '@/assets/styles/neon_city.png';
import boginyaImg from '@/assets/styles/goddess.png';
import tikhayaRoskoshImg from '@/assets/styles/tropics.png';
import idealnyj_kadrImg from '@/assets/styles/social_profile.png';
import bwportraitImg from '@/assets/styles/bw_portrait.png';

// ── MEN PREMIUM CINEMATIC: превью-изображения ────────────────────────────────
import menDesertKingImg   from '@/assets/styles/Desert King.png';
import menBigCatchImg     from '@/assets/styles/Big Catch.png';
import menKingOceanImg    from '@/assets/styles/King of the Ocean..png';
import menMasterLifeImg   from '@/assets/styles/Master of Life.png';
// ── MEN PREMIUM CINEMATIC (вторая волна) ─────────────────────────────────────
import menTechFounderImg  from '@/assets/styles/tech_founder.png';
import menBusinessClassImg from '@/assets/styles/business_class.png';
import menSurferImg       from '@/assets/styles/surfer.png';
import menLegendWarriorImg from '@/assets/styles/legend_warrior.png';

// ── ПАРНЫЕ ФОТО: превью-изображения ─────────────────────────────────────────
// Реальные карточки парных стилей (загружены в assets/styles/).
// Prompt в этих записях пустой: реальный prompt хранится только в БД и
// оборачивается server-side через buildPairPrompt() → не доверяем клиенту.
import pairLoveStoryImg from '@/assets/styles/LOVE STORY.png';
import pairMotherChildImg from '@/assets/styles/MOTHER AND CHILD.png';
import pairDadBabyImg from '@/assets/styles/DAD AND BABY.png';
import pairBestFriendsImg from '@/assets/styles/best friends.png';
import pairBusinessDuoImg from '@/assets/styles/BUSINESS DUO.png';

export const STYLES: Style[] = [
  // ── РЕАЛИЗМ: premium lifestyle для массового пользователя ───────────────────
  {
    id: 'social_portrait',
    name: 'ОБРАЗ ДЛЯ СОЦСЕТЕЙ',
    category: 'realistic',
    description: 'Premium influencer aesthetic — естественный, чистый, дорогой.',
    prompt: '',
    previewUrl: idealnyj_kadrImg,
  },
  {
    id: 'business_elite',
    name: 'ЛИДЕР',
    category: 'realistic',
    description: 'CEO, успех, статус — чистый дорогой офисный образ.',
    prompt: '',
    previewUrl: liderImg,
  },
  {
    id: 'bw_portrait',
    name: 'ЧЁРНО-БЕЛЫЙ ПОРТРЕТ',
    category: 'realistic',
    description: 'Timeless monochrome — классический журнальный портрет в ч/б.',
    // prompt намеренно пустой — backend читает из БД (migration 020).
    // Детектор isBWPortrait в buildPrompt() использует styleId === 'bw_portrait'
    // как страховочный сигнал — не зависит от bundle-промпта.
    prompt: '',
    previewUrl: bwportraitImg,
  },
  {
    id: 'old_money',
    name: 'РОСКОШЬ',
    category: 'realistic',
    description: 'Тепло, дорого, спокойно — luxury lifestyle в европейском свете.',
    prompt: '',
    previewUrl: roskoshImg,
  },
  {
    id: 'parisian_chic',
    name: 'РОМАНТИКА',
    category: 'realistic',
    description: 'Красивая жизнь, цветы, лето — Pinterest luxury lifestyle.',
    prompt: '',
    previewUrl: romantikaImg,
  },
  {
    id: 'evening_glamour',
    name: 'РОКОВАЯ',
    category: 'realistic',
    description: 'Дорогая элегантность вечера — luxury restaurant, premium glamour.',
    prompt: '',
    previewUrl: rokovayaImg,
  },
  {
    id: 'milano_style',
    name: 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
    category: 'realistic',
    description: 'Luxury travel lifestyle — Италия, Испания, Средиземноморье.',
    prompt: '',
    previewUrl: bolshoePatheshestvieImg,
  },
  {
    id: 'scandinavian_minimal',
    name: 'АЛЬПИЙСКАЯ СКАЗКА',
    category: 'realistic',
    description: 'Winter luxury — шале, Альпы, снег, тепло и уют.',
    prompt: '',
    previewUrl: zimnyayaSkazkaImg,
  },
  {
    id: 'quiet_luxury',
    name: 'ЛЕТНИЙ ГОРОД',
    category: 'realistic',
    description: 'Лето, воздух, яркость — rooftop, оранж и бирюза, sunlight.',
    prompt: '',
    previewUrl: mirBudushchegoImg,
  },
  {
    id: 'golden_hour_glow',
    name: 'ДИКАЯ ПРИРОДА',
    category: 'realistic',
    description: 'Свобода, свежесть, северная эстетика — лес, горы, природа.',
    prompt: '',
    previewUrl: dikayaPrirodaImg,
  },
  {
    id: 'elite_sport',
    name: 'СПОРТ',
    category: 'realistic',
    description: 'Athletic lifestyle — premium sport editorial, энергия, сила.',
    prompt: '',
    previewUrl: eliteSportImg,
  },

  // ── ПАРНЫЕ ФОТО ─────────────────────────────────────────────────────────────
  {
    id: 'couple_love_story',
    name: 'ИСТОРИЯ ЛЮБВИ',
    category: 'together',
    description: 'Романтичная фотосессия для пары с теплом, близостью и красивой эмоцией.',
    prompt: '',
    previewUrl: pairLoveStoryImg,
  },
  {
    id: 'mother_child',
    name: 'МАМА И РЕБЁНОК',
    category: 'together',
    description: 'Нежный кадр мамы и ребёнка: любовь, мягкий свет и семейное тепло.',
    prompt: '',
    previewUrl: pairMotherChildImg,
  },
  {
    id: 'father_child',
    name: 'ПАПА И РЕБЁНОК',
    category: 'together',
    description: 'Тёплая фотосессия папы и ребёнка: радость, защита и настоящая эмоция.',
    prompt: '',
    previewUrl: pairDadBabyImg,
  },
  {
    id: 'best_friends',
    name: 'ЛУЧШИЕ ДРУЗЬЯ',
    category: 'together',
    description: 'Живая съёмка для друзей: смех, энергия, настоящая связь и стильный кадр.',
    prompt: '',
    previewUrl: pairBestFriendsImg,
  },
  {
    id: 'business_duo',
    name: 'ДЕЛОВОЙ ДУЭТ',
    category: 'together',
    description: 'Статусный деловой портрет для партнёров, команды или совместного бренда.',
    prompt: '',
    previewUrl: pairBusinessDuoImg,
  },

  // ── ДЕТИ ────────────────────────────────────────────────────────────────────
  // previewUrl — пути сервера (nginx /style-previews/kids/), не бандл-ассеты.
  //
  // Wave-1 (kids_sport_champion…kids_ice_grace): детальные prompts в БД (migration 004).
  //   В bundle prompt='' — нормально: backend ВСЕГДА читает из БД.
  //
  // Wave-2 (kosmos…little_ceo_girl): не имели migration-файла в репо (migration 021 исправляет).
  //   Здесь прописаны fallback prompts для:
  //     а) bundle-fallback при недоступности /api/styles (display reference);
  //     б) документирования стилевого намерения;
  //     в) корректного срабатывания детекторов buildPrompt() (isLittleCeoGirl и др.).
  {
    id: 'kids_sport_champion',
    name: 'Юный чемпион',
    category: 'kids',
    description: 'Кинематографичный портрет ребёнка-футболиста на большом стадионе под софитами.',
    prompt: '',
    previewUrl: '/style-previews/kids/kids_sport_champion.png',
  },
  {
    id: 'kids_cozy_childhood',
    name: 'Уют детства',
    category: 'kids',
    description: 'Тёплый уютный вечерний портрет ребёнка с плюшевым мишкой у камина — медовый свет, дом.',
    prompt: '',
    previewUrl: '/style-previews/kids/kids_cozy_childhood.png',
  },
  {
    id: 'kids_ballet',
    name: 'Маленькая балерина',
    category: 'kids',
    description: 'Классическая театральная фотосессия юной балерины на сцене старинной оперы.',
    prompt: '',
    previewUrl: '/style-previews/kids/kids_ballet.png',
  },
  {
    id: 'kids_savanna',
    name: 'Саванна',
    category: 'kids',
    description: 'Кинематографичный закатный портрет ребёнка-принцессы в саванне рядом с львёнком.',
    prompt: '',
    previewUrl: '/style-previews/kids/kids_savanna.png',
  },
  {
    id: 'kids_ice_grace',
    name: 'Ледяная грация',
    category: 'kids',
    description: 'Олимпийский портрет юной фигуристки в ледяном голубом костюме со стразами.',
    prompt: '',
    previewUrl: '/style-previews/kids/kids_ice_grace.png',
  },
  // ── KIDS WAVE-2: prompts в БД (migration 021), в bundle намеренно пустые ──────
  // Backend читает prompt из DB напрямую по styleId.
  // Bundle prompt='' — безопасно: frontend никогда не передаёт prompt на сервер,
  // только styleId. Детекторы (isLittleCeoGirl и др.) используют styleId-сигнал
  // из generation.ts, не зависят от bundle-промпта.
  {
    id: 'kosmos',
    name: 'ЮНЫЙ КОСМОНАВТ',
    category: 'kids',
    description: 'Маленький герой в космическом костюме исследует вселенную с широко открытыми глазами.',
    prompt: '',
    previewUrl: '/style-previews/kids/kosmos.png',
  },
  {
    id: 'yunyj_reporter',
    name: 'ЮНЫЙ РЕПОРТЁР',
    category: 'kids',
    description: 'Маленький журналист с камерой и блокнотом: любопытство, уверенность и городские репортажи.',
    prompt: '',
    previewUrl: '/style-previews/kids/yunyj-reporter.png',
  },
  {
    id: 'malyj_lider',
    name: 'МАЛЫЙ ЛИДЕР',
    category: 'kids',
    description: 'Уверенный маленький лидер с ярким характером и атмосферой будущего чемпиона.',
    prompt: '',
    previewUrl: '/style-previews/kids/malyj-lider.png',
  },
  {
    id: 'ledyanaya_skazka',
    name: 'ЛЕДЯНАЯ СКАЗКА',
    category: 'kids',
    description: 'Зимняя магия: снежные пейзажи, сказочная атмосфера, элегантный winter fairy tale.',
    prompt: '',
    previewUrl: '/style-previews/kids/ledyanaya-skazka.png',
  },
  {
    id: 'yunaya_zvezda',
    name: 'ЮНАЯ ЗВЕЗДА',
    category: 'kids',
    description: 'Маленькая звезда сцены: артистизм, свет прожекторов и магия выступления.',
    prompt: '',
    previewUrl: '/style-previews/kids/yunaya-zvezda-v2.png',
  },
  {
    // Переименован: 'ДИКАЯ ПРИРОДА' → 'ЮНЫЙ СЛЕДОПЫТ'. ID сохранён.
    id: 'dikaya_priroda_kids',
    name: 'ЮНЫЙ СЛЕДОПЫТ',
    category: 'kids',
    description: 'Маленький исследователь в дикой природе: лес, горы, приключение и cinematic свобода.',
    prompt: '',
    previewUrl: '/style-previews/kids/dikaya-priroda.png',
  },
  {
    id: 'yunyj_volshebnik',
    name: 'ЮНЫЙ ВОЛШЕБНИК',
    category: 'kids',
    description: 'Маленький волшебник с книгой заклинаний: фэнтезийная атмосфера, магия и cinematic wonder.',
    prompt: '',
    previewUrl: '/style-previews/kids/yunyj-volshebnik.png',
  },
  {
    id: 'little_ceo_girl',
    name: 'МАЛЕНЬКАЯ ЛЕДИ-БОСС',
    category: 'kids',
    description: 'Кинематографический портрет уверенной маленькой леди в элегантном деловом костюме.',
    prompt: '',
    previewUrl: '/style-previews/kids/little-ceo-girl.png',
  },

  // ── ПРЕМИУМ: cinematic / luxury / fantasy ───────────────────────────────────
  {
    id: 'intellectual_elegance',
    name: 'БОГИНЯ',
    category: 'premium',
    description: 'Эпичная женская сила — море, скалы, закат, cinematic.',
    prompt: '',
    previewUrl: boginyaImg,
  },
  {
    id: 'new_york_power',
    name: 'МОНАКО',
    category: 'premium',
    description: 'Яхты, Монако, дорогая динамичная жизнь.',
    prompt: '',
    previewUrl: skorostImg,
  },
  {
    id: 'royal_bear',
    name: 'ТРОПИКИ',
    category: 'premium',
    description: 'Luxury vacation — пляж, бирюза, tropical villa, ocean.',
    prompt: '',
    previewUrl: tikhayaRoskoshImg,
  },
  {
    id: 'luxe_editorial',
    name: 'НЕОНОВЫЙ ГОРОД',
    category: 'premium',
    description: 'Futuristic luxury — архитектурный неон, cyber premium.',
    prompt: '',
    previewUrl: vysokayaModaImg,
  },

  // ── MEN PREMIUM CINEMATIC ────────────────────────────────────────────────────
  // Prompt пустой — реальный prompt хранится в БД и оборачивается buildPrompt() server-side.
  // Превью взяты из референсных изображений src/assets/styles/.
  // Названия русские (UI), промпт-теги в БД остаются английскими ([MEN: DESERT KING] и т.д.).
  {
    id: 'men_desert_king',
    name: 'Повелитель пустыни',
    category: 'men',
    description: 'Роскошное путешествие — внедорожник, каньон, закат. Сила и свобода.',
    prompt: '',
    previewUrl: menDesertKingImg,
  },
  {
    id: 'men_big_catch',
    name: 'Большой улов',
    category: 'men',
    description: 'Кинематографичная рыбалка — трофейный момент с характером и радостью победы.',
    prompt: '',
    previewUrl: menBigCatchImg,
  },
  {
    id: 'men_king_ocean',
    name: 'Король океана',
    category: 'men',
    description: 'Яхтенный lifestyle — атлетизм, открытый океан, тропический закат.',
    prompt: '',
    previewUrl: menKingOceanImg,
  },
  {
    id: 'men_master_life',
    name: 'Хозяин жизни',
    category: 'men',
    description: 'Лидер рядом со львом — сила, стиль, африканский золотой закат.',
    prompt: '',
    previewUrl: menMasterLifeImg,
  },

  // ── MEN PREMIUM CINEMATIC (вторая волна) ─────────────────────────────────────
  {
    id: 'tech_founder',
    name: 'Интеллектуал',
    category: 'men',
    description: 'Умный образованный мужчина — интеллект, статус, уверенность. Стильный кэжуал, аналитический взгляд.',
    prompt: '',
    previewUrl: menTechFounderImg,
  },
  {
    id: 'private_jet',
    name: 'Бизнес-Класс',
    category: 'men',
    description: 'Luxury перелёт — private jet, стиль, спокойствие. Дорогая жизнь над облаками.',
    prompt: '',
    previewUrl: menBusinessClassImg,
  },
  {
    id: 'surfer',
    name: 'Атлет',
    category: 'men',
    description: 'Спортивный мужчина — атлетичная форма, энергия, современный фитнес-образ.',
    prompt: '',
    previewUrl: menSurferImg,
  },
  {
    id: 'legend_warrior',
    name: 'Легендарный Воин',
    category: 'men',
    description: 'Воин в тёмных доспехах в заснеженных горах — эпика, сила, кинематографичная тьма.',
    prompt: '',
    previewUrl: menLegendWarriorImg,
  },
];

export const PACKAGES: Package[] = [
  {
    id: PlanType.START,
    name: 'СТАРТ',
    price: 199,
    credits: 5,
    stylesLimit: 2,
    description: 'Для тех, кто хочет попробовать',
    features: ['5 генераций', '2 стиля на выбор', 'Стандартная очередь'],
  },
  {
    id: PlanType.PREMIUM,
    name: 'ПРЕМИУМ',
    price: 499,
    credits: 15,
    stylesLimit: 10,
    description: 'Самый популярный выбор',
    features: ['15 генераций', '10 стилей на выбор', 'Ускоренная обработка'],
  },
  {
    id: PlanType.VIP,
    name: 'VIP',
    price: 999,
    credits: 40,
    stylesLimit: 'all',
    description: 'Максимальный результат',
    features: ['40 генераций', 'Все стили доступны', 'Приоритетная очередь'],
  },
];

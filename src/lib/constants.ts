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

import { PlanType, Style, Package } from '../types';

import roskoshImg from '@/assets/styles/roskosh.png';
import liderImg from '@/assets/styles/lider.png';
import dikayaPrirodaImg from '@/assets/styles/dikaya-priroda.png';
import zimnyayaSkazkaImg from '@/assets/styles/zimnyaya-skazka.png';
import skorostImg from '@/assets/styles/skorost.png';
import rokovayaImg from '@/assets/styles/rokovaya.png';
import eliteSportImg from '@/assets/styles/elite-sport.png';
import bolshoePatheshestvieImg from '@/assets/styles/bolshoe-puteshestvie.png';
import romantikaImg from '@/assets/styles/romantika.png';
import mirBudushchegoImg from '@/assets/styles/mir-budushchego.png';
import vysokayaModaImg from '@/assets/styles/vysokaya-moda.png';
import boginyaImg from '@/assets/styles/boginya.png';
import tikhayaRoskoshImg from '@/assets/styles/quiet-luxury.png';
import idealnyj_kadrImg from '@/assets/styles/idealnyj-kadr.png';
// TODO: заменить на реальные превью после готовности изображений
import creativestudioImg from '@/assets/styles/romantika.png';
import bwportraitImg from '@/assets/styles/lider.png';

// Порядок отображения в табах: hero-стили идут первыми внутри своей категории.
// Категории — эмоциональные, не жанровые. Пользователь выбирает lifestyle fantasy.
export const STYLES: Style[] = [
  // ── БИЗНЕС: успех, статус, личный бренд ─────────────────────────────────────
  {
    id: 'business_elite',
    name: 'ЛИДЕР',
    category: 'business',
    description: 'CEO, успех, статус — чистый дорогой офисный образ.',
    prompt: '',
    previewUrl: liderImg,
  },
  {
    id: 'old_money',
    name: 'РОСКОШЬ',
    category: 'business',
    description: 'Тепло, дорого, спокойно — luxury lifestyle в европейском свете.',
    prompt: '',
    previewUrl: roskoshImg,
  },
  {
    id: 'social_portrait',
    name: 'ОБРАЗ ДЛЯ СОЦСЕТЕЙ',
    category: 'business',
    description: 'Premium influencer aesthetic — естественный, чистый, дорогой.',
    prompt: '',
    previewUrl: idealnyj_kadrImg,
  },

  // ── ЖЕНСКИЕ: сила, романтика, элегантность ───────────────────────────────────
  {
    id: 'intellectual_elegance',
    name: 'БОГИНЯ',
    category: 'women',
    description: 'Эпичная женская сила — море, скалы, закат, cinematic.',
    prompt: '',
    previewUrl: boginyaImg,
  },
  {
    id: 'parisian_chic',
    name: 'РОМАНТИКА',
    category: 'women',
    description: 'Красивая жизнь, цветы, лето — Pinterest luxury lifestyle.',
    prompt: '',
    previewUrl: romantikaImg,
  },
  {
    id: 'evening_glamour',
    name: 'РОКОВАЯ',
    category: 'women',
    description: 'Дорогая элегантность вечера — luxury restaurant, premium glamour.',
    prompt: '',
    previewUrl: rokovayaImg,
  },

  // ── ПУТЕШЕСТВИЯ: яхты, Европа, тропики, горы ────────────────────────────────
  {
    id: 'new_york_power',
    name: 'МОНАКО',
    category: 'travel',
    description: 'Яхты, Монако, дорогая динамичная жизнь.',
    prompt: '',
    previewUrl: skorostImg,
  },
  {
    id: 'milano_style',
    name: 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
    category: 'travel',
    description: 'Luxury travel lifestyle — Италия, Испания, Средиземноморье.',
    prompt: '',
    previewUrl: bolshoePatheshestvieImg,
  },
  {
    id: 'scandinavian_minimal',
    name: 'АЛЬПИЙСКАЯ СКАЗКА',
    category: 'travel',
    description: 'Winter luxury — шале, Альпы, снег, тепло и уют.',
    prompt: '',
    previewUrl: zimnyayaSkazkaImg,
  },
  {
    id: 'royal_bear',
    name: 'ТРОПИКИ',
    category: 'travel',
    description: 'Luxury vacation — пляж, бирюза, tropical villa, ocean.',
    prompt: '',
    previewUrl: tikhayaRoskoshImg,
  },

  // ── ПРИРОДА: воздух, свобода, северная эстетика ─────────────────────────────
  {
    id: 'golden_hour_glow',
    name: 'ДИКАЯ ПРИРОДА',
    category: 'nature',
    description: 'Свобода, свежесть, северная эстетика — лес, горы, природа.',
    prompt: '',
    previewUrl: dikayaPrirodaImg,
  },

  // ── СПОРТ ────────────────────────────────────────────────────────────────────
  {
    id: 'elite_sport',
    name: 'СПОРТ',
    category: 'sport',
    description: 'Athletic lifestyle — premium sport editorial, энергия, сила.',
    prompt: '',
    previewUrl: eliteSportImg,
  },

  // ── ЯРКИЕ ────────────────────────────────────────────────────────────────────
  {
    id: 'quiet_luxury',
    name: 'ЛЕТНИЙ ГОРОД',
    category: 'bright',
    description: 'Лето, энергия, яркость — rooftop, летние улицы, пляж-кафе.',
    prompt: '',
    previewUrl: mirBudushchegoImg,
  },
  {
    id: 'luxe_editorial',
    name: 'НЕОНОВЫЙ ГОРОД',
    category: 'bright',
    description: 'Futuristic luxury — архитектурный неон, cyber premium.',
    prompt: '',
    previewUrl: vysokayaModaImg,
  },
  {
    id: 'creative_studio',
    name: 'ТВОРЧЕСКАЯ СТУДИЯ',
    category: 'bright',
    description: 'Арт-лофт, богемность, тепло — premium creative aesthetic.',
    prompt: '',
    previewUrl: creativestudioImg,
  },

  // ── БИЗНЕС (дополнительно) ────────────────────────────────────────────────
  {
    id: 'bw_portrait',
    name: 'ЧЁРНО-БЕЛЫЙ ПОРТРЕТ',
    category: 'business',
    description: 'Timeless monochrome — классический журнальный портрет в ч/б.',
    prompt: '',
    previewUrl: bwportraitImg,
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

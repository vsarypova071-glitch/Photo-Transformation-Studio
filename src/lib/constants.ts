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
import carskayaOhotaImg from '@/assets/styles/carskaya-ohota.png';

const STYLES_RAW: Style[] = [
  // РЕАЛИЗМ - 12 стилей
  {
    id: 'old_money',
    name: 'РОСКОШЬ',
    category: 'realistic',
    description: 'Роскошный premium-образ в стиле quiet luxury, дорогие интерьеры, элегантность, статус и мягкий cinematic свет.',
    prompt: '',
    previewUrl: roskoshImg
  },
  {
    id: 'business_elite',
    name: 'ЛИДЕР',
    category: 'realistic',
    description: 'Сильный деловой образ с атмосферой власти, уверенности и современного успеха.',
    prompt: '',
    previewUrl: liderImg
  },
  {
    id: 'golden_hour_glow',
    name: 'ДИКАЯ ПРИРОДА',
    category: 'realistic',
    description: 'Атмосфера свободы, природы и приключений. Лес, горы, натуральные ткани и естественный свет.',
    prompt: '',
    previewUrl: dikayaPrirodaImg
  },
  {
    id: 'scandinavian_minimal',
    name: 'ЗИМНЯЯ СКАЗКА',
    category: 'realistic',
    description: 'Снежная эстетика, холодный свет, зимняя элегантность и магическая атмосфера.',
    prompt: '',
    previewUrl: zimnyayaSkazkaImg
  },
  {
    id: 'new_york_power',
    name: 'СКОРОСТЬ',
    category: 'realistic',
    description: 'Динамичный cinematic-образ с энергией движения, ночного города и адреналина.',
    prompt: '',
    previewUrl: skorostImg
  },
  {
    id: 'evening_glamour',
    name: 'РОКОВАЯ',
    category: 'realistic',
    description: 'Драматичный женственный образ с атмосферой кино, загадочности и luxury glamour.',
    prompt: '',
    previewUrl: rokovayaImg
  },
  {
    id: 'elite_sport',
    name: 'ЭЛИТНЫЙ СПОРТ',
    category: 'realistic',
    description: 'Luxury cinematic fitness lifestyle. Elite performance, luxury wellness и powerful femininity.',
    prompt: '',
    previewUrl: eliteSportImg
  },
  {
    id: 'milano_style',
    name: 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
    category: 'realistic',
    description: 'Эстетика путешествий, свободы и красивых мест по всему миру.',
    prompt: '',
    previewUrl: bolshoePatheshestvieImg
  },
  {
    id: 'parisian_chic',
    name: 'РОМАНТИКА',
    category: 'realistic',
    description: 'Теплый романтический образ с мягким светом, нежностью и атмосферой love story.',
    prompt: '',
    previewUrl: romantikaImg
  },
  {
    id: 'quiet_luxury',
    name: 'МИР БУДУЩЕГО',
    category: 'realistic',
    description: 'Футуристичный стиль с неоновым светом, технологичной атмосферой и sci-fi эстетикой.',
    prompt: '',
    previewUrl: mirBudushchegoImg
  },
  {
    id: 'luxe_editorial',
    name: 'ВЫСОКАЯ МОДА',
    category: 'realistic',
    description: 'Fashion editorial в стиле глянцевого журнала и luxury fashion photography.',
    prompt: '',
    previewUrl: vysokayaModaImg
  },
  {
    id: 'intellectual_elegance',
    name: 'БОГИНЯ',
    category: 'realistic',
    description: 'Величественный женственный образ с мягким сиянием, античной эстетикой и атмосферой силы.',
    prompt: '',
    previewUrl: boginyaImg
  },

  // ПРЕМИУМ - с природой
  {
    id: 'royal_bear',
    name: 'ЦАРСКАЯ ОХОТА',
    category: 'wild',
    description: 'Аристократический outdoor-стиль с лесной атмосферой, статусом и cinematic realism.',
    prompt: '',
    previewUrl: carskayaOhotaImg
  }
];

// Порядок отображения стилей realism (соответствует sort_order в БД)
const REALISTIC_ORDER = [
  'old_money',             // РОСКОШЬ
  'business_elite',        // ЛИДЕР
  'golden_hour_glow',      // ДИКАЯ ПРИРОДА
  'scandinavian_minimal',  // ЗИМНЯЯ СКАЗКА
  'new_york_power',        // СКОРОСТЬ
  'evening_glamour',       // РОКОВАЯ
  'elite_sport',           // ЭЛИТНЫЙ СПОРТ
  'milano_style',          // БОЛЬШОЕ ПУТЕШЕСТВИЕ
  'parisian_chic',         // РОМАНТИКА
  'quiet_luxury',          // МИР БУДУЩЕГО
  'luxe_editorial',        // ВЫСОКАЯ МОДА
  'intellectual_elegance', // БОГИНЯ
];

const realisticOrdered = REALISTIC_ORDER
  .map(id => STYLES_RAW.find(s => s.id === id))
  .filter((s): s is Style => Boolean(s));

const otherStyles = STYLES_RAW.filter(
  s => s.category !== 'realistic' || !REALISTIC_ORDER.includes(s.id)
);

export const STYLES: Style[] = [...realisticOrdered, ...otherStyles];

export const PACKAGES: Package[] = [
  {
    id: PlanType.START,
    name: 'СТАРТ',
    price: 199,
    credits: 5,
    stylesLimit: 2,
    description: 'Для тех, кто хочет попробовать',
    features: ['5 генераций', '2 стиля на выбор', 'Стандартная очередь']
  },
  {
    id: PlanType.PREMIUM,
    name: 'ПРЕМИУМ',
    price: 499,
    credits: 15,
    stylesLimit: 10,
    description: 'Самый популярный выбор',
    features: ['15 генераций', '10 стилей на выбор', 'Ускоренная обработка']
  },
  {
    id: PlanType.VIP,
    name: 'VIP',
    price: 999,
    credits: 40,
    stylesLimit: 'all',
    description: 'Максимальный результат',
    features: ['40 генераций', 'Все стили доступны', 'Приоритетная очередь']
  }
];

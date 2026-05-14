import { PlanType, Style, Package } from '../types';

import quietLuxuryImg from '@/assets/styles/quiet-luxury.png';
import intellectualEleganceImg from '@/assets/styles/intellectual-elegance.png';
import luxuryEditorialImg from '@/assets/styles/luxury-editorial.png';
import oldMoneyImg from '@/assets/styles/old-money.png';
import milanoEleganceImg from '@/assets/styles/milano-elegance.png';
import parisianChicImg from '@/assets/styles/parisian-chic.png';
import scandinavianMinimalImg from '@/assets/styles/scandinavian-minimal.png';
import newYorkPowerImg from '@/assets/styles/new-york-power.png';
import luxuryResortImg from '@/assets/styles/luxury-resort.png';
import eveningGlamourImg from '@/assets/styles/evening-glamour.png';
import businessEliteImg from '@/assets/styles/business-elite.png';
import royalPresenceImg from '@/assets/styles/royal-presence.png';

const STYLES_RAW: Style[] = [
  // РЕАЛИЗМ - 12 стилей
  {
    id: 'old_money',
    name: 'РОСКОШЬ',
    category: 'realistic',
    description: 'Роскошный premium-образ в стиле quiet luxury, дорогие интерьеры, элегантность, статус и мягкий cinematic свет.',
    prompt: '[OLD MONEY] Grand European interior — tall windows with sheer curtains, parquet floors, antique furniture, pale walls with museum-quality art. She is at home here, not visiting. Soft natural light through high windows with warm golden undertones on ivory walls. Fashion: quiet luxury precision — wide-leg trousers in ivory or warm camel, fine cashmere blazer or silk blouse, minimal real jewelry without statement pieces. Realistic matte fabric texture, natural authentic folds, quality fabric weight. Shallow depth of field, off-center cinematic framing. Direct calm eye contact — ownership, not performance. Color palette: ivory, warm camel, aged gold, cognac, cream marble. Camera: Leica SL2, 75mm Summicron APO.',
    previewUrl: oldMoneyImg
  },
  {
    id: 'business_elite',
    name: 'ЛИДЕР',
    category: 'realistic',
    description: 'Сильный деловой образ с атмосферой власти, уверенности и современного успеха.',
    prompt: '[CEO POWER] Architectural glass tower — floor-to-ceiling windows with city skyline at dusk, clean geometric lines, premium minimal interior, polished stone or steel surfaces. She owns the room. Strong directional sculptural lighting — precise and powerful, like a spotlight on authority. Fashion: executive precision — sharp-tailored power suit or structured blazer in charcoal, deep navy or slate, luxury minimal accessories, refined footwear. Realistic wool texture, visible stitching, matte finish. Direct powerful eye contact, commanding confidence without aggression. Color palette: charcoal grey, deep navy, steel, crisp white, black. Camera: Canon EOS R5, 85mm f/1.2.',
    previewUrl: businessEliteImg
  },
  {
    id: 'golden_hour_glow',
    name: 'ДИКАЯ ПРИРОДА',
    category: 'realistic',
    description: 'Атмосфера свободы, природы и приключений. Лес, горы, натуральные ткани и естественный свет.',
    prompt: 'Cinematic outdoor portrait in wild nature — forest, mountain or open landscape. Rich natural daylight, golden hour warmth or soft overcast. Premium outdoor fashion: tailored wool coat, quality knit sweater or leather jacket in earthy forest tones. Realistic wool and leather texture — natural fabric weight, authentic outdoor character. Strong natural expression — free, alive, grounded. Shot on Nikon Z9, 85mm f/1.4, natural available light only. Atmospheric depth, cinematic outdoor color grading. Color palette: forest green, cognac brown, warm ivory, deep earth, moss.',
    previewUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'scandinavian_minimal',
    name: 'ЗИМНЯЯ СКАЗКА',
    category: 'realistic',
    description: 'Снежная эстетика, холодный свет, зимняя элегантность и магическая атмосфера.',
    prompt: 'Cinematic winter portrait with magical snow atmosphere. Soft cold natural light — overcast winter sky or gentle indoor warmth. Elegant winter fashion: long cashmere overcoat, fine knit turtleneck in white, pearl grey, ice blue or silver. Realistic cashmere and wool texture — natural fabric weight, subtle authentic folds, quality winter wear. Serene elegant expression, quiet inner strength. Shot on Hasselblad X2D, 90mm. Shallow depth of field, atmospheric winter depth. Natural skin, real hair. Color palette: white, pearl grey, ice blue, silver, champagne.',
    previewUrl: scandinavianMinimalImg
  },
  {
    id: 'new_york_power',
    name: 'СКОРОСТЬ',
    category: 'realistic',
    description: 'Динамичный cinematic-образ с энергией движения, ночного города и адреналина.',
    prompt: 'Cinematic night city portrait with energy and adrenaline. Dark urban backdrop — bokeh streetlights, wet asphalt reflections, neon glow. Contemporary urban fashion: tailored dark coat, sleek leather jacket or structured blazer in black, deep navy or midnight. Realistic leather and fabric texture — matte finish, natural folds, authentic urban wear. Dynamic confident posture, alive and driven. Shot on Nikon Z9, 50mm f/1.2, available night light. Atmospheric cinematic depth, no CGI glow. Color palette: black, deep navy, electric neon blue, wet asphalt silver.',
    previewUrl: newYorkPowerImg
  },
  {
    id: 'evening_glamour',
    name: 'РОКОВАЯ',
    category: 'realistic',
    description: 'Драматичный женственный образ с атмосферой кино, загадочности и luxury glamour.',
    prompt: 'Cinematic portrait with film noir elegance — mysterious, powerful, magnetic. Dramatic low-key lighting with deep sculpted shadows and precise cinematic highlights. Stunning evening fashion: sleek evening dress or luxurious structured ensemble in black, deep burgundy or midnight blue. Realistic silk and velvet texture — natural fabric drape, elegant folds, authentic weight. Mysterious confident expression. Shot on Hasselblad H6D, 80mm. Authentic photography — real skin, no overprocessed beauty. Color palette: black, deep burgundy, midnight blue, gold accent.',
    previewUrl: eveningGlamourImg
  },
  {
    id: 'luxury_resort',
    name: 'ЗАТЕРЯННЫЙ МИР',
    category: 'realistic',
    description: 'Приключенческий стиль с атмосферой древнего мира, джунглей и cinematic expedition.',
    prompt: '[LUXURY EXPLORER] Ancient temple ruins half-reclaimed by lush jungle, mystical forest with golden shafts of light through dense canopy, or dramatic volcanic landscape at golden hour. She has been everywhere worth going. Natural dramatic light — warm amber shafts, deep shadow pockets, atmospheric cinematic depth. Fashion: elevated expedition — structured waxed field jacket in khaki or olive, quality canvas coat, leather accessories. Realistic matte waxed canvas and leather texture, authentic weathered character. Adventurous confident presence — explorer, not tourist. Color palette: amber, jungle green, deep earth, shadow brown, ancient gold. Camera: Sony A7R V, 85mm f/1.4.',
    previewUrl: luxuryResortImg
  },
  {
    id: 'milano_style',
    name: 'БОЛЬШОЕ ПУТЕШЕСТВИЕ',
    category: 'realistic',
    description: 'Эстетика путешествий, свободы и красивых мест по всему миру.',
    prompt: 'Cinematic travel portrait — authentic fashion photography in beautiful world destinations. European architecture, Mediterranean coastline or exotic landscape backdrop. Elevated travel fashion: tailored coat, quality linen or cashmere ensemble in terracotta, warm sand, ocean blue or olive. Realistic fabric texture — natural folds, authentic travel wear character. Effortlessly stylish, candid confident pose. Shot on Leica Q3, 28mm, natural available light. Atmospheric outdoor depth, cinematic travel color grading. Color palette: terracotta, warm sand, ocean blue, linen, sage olive.',
    previewUrl: milanoEleganceImg
  },
  {
    id: 'parisian_chic',
    name: 'РОМАНТИКА',
    category: 'realistic',
    description: 'Теплый романтический образ с мягким светом, нежностью и атмосферой love story.',
    prompt: '[SENSUAL PARIS] An intimate Paris moment — private haussmann apartment with tall windows at dusk, warm-lit brasserie with golden interior glow, or garden terrace as the evening turns blue. The most interesting woman in the most beautiful city. Soft intimate lighting — warm candle glow, golden hour through glass, gentle diffused indoor warmth. Fashion: effortlessly feminine — flowing silk dress, fine knit with beautiful natural drape, delicate fabric in blush, ivory, dusty rose or champagne. Realistic silk and fine wool texture, natural fabric movement, soft authentic folds. Direct eye contact — knowing, present, magnetic. Color palette: blush, champagne, ivory, dusty rose, warm gold. Camera: Leica Q3, 28mm, film-like warmth.',
    previewUrl: parisianChicImg
  },
  {
    id: 'quiet_luxury',
    name: 'МИР БУДУЩЕГО',
    category: 'realistic',
    description: 'Футуристичный стиль с неоновым светом, технологичной атмосферой и sci-fi эстетикой.',
    prompt: '[FUTURE LUXURY] Avant-garde architectural interior — sculptural white-and-glass museum space, dramatic geometric lighting installation, high-design gallery or luxury hotel lobby. The future is already here. Dramatic cool neon-blue or silver-white architectural lighting with deep shadow architecture. Fashion: structural luxury minimalism — clean geometric silhouette in white, silver, deep midnight or ice blue, premium technical fabric. Realistic matte technical fabric texture, precise construction, sharp tailoring. Calm visionary presence, direct gaze — she is already where others are going. Color palette: deep midnight, silver white, ice blue, violet accent, architectural shadow. Camera: Sony A7R V, 50mm f/1.2.',
    previewUrl: quietLuxuryImg
  },
  {
    id: 'luxe_editorial',
    name: 'ВЫСОКАЯ МОДА',
    category: 'realistic',
    description: 'Fashion editorial в стиле глянцевого журнала и luxury fashion photography.',
    prompt: 'High-end fashion editorial portrait — luxury magazine quality, Vogue / Harper\'s Bazaar aesthetic. Dramatic professional studio lighting with cinematic sculpted depth. Premium editorial fashion: couture-level silhouette in exceptional fabric — structured crepe, heavy silk or tailored precision. Realistic fabric texture — matte surface, visible construction detail, authentic fashion photography quality. Dynamic powerful editorial pose. Shot on Phase One IQ4, Broncolor studio. Real skin texture, no artificial beauty filter. Color palette: bold fashion statement — deep black, sculptural neutral or high-contrast editorial tones.',
    previewUrl: luxuryEditorialImg
  },
  {
    id: 'intellectual_elegance',
    name: 'БОГИНЯ',
    category: 'realistic',
    description: 'Величественный женственный образ с мягким сиянием, античной эстетикой и атмосферой силы.',
    prompt: 'Cinematic portrait with timeless feminine power — goddess aesthetic. Soft luminous light — gentle diffused studio glow or natural daylight through sheer fabric. Flowing elegant fashion: draped silk dress, structured gown or refined ensemble in ivory, soft gold, sage or warm earth. Realistic silk and chiffon texture — natural drape, flowing folds, elegant fabric weight. Serene powerful expression — inner strength, quiet magnetism. Shot on Sony A1, 85mm f/1.4. Shallow depth of field, atmospheric glow. Authentic photography quality — natural skin, real hair. Color palette: ivory white, warm gold, sage green, luminous cream.',
    previewUrl: intellectualEleganceImg
  },

  // ПРЕМИУМ - с природой
  {
    id: 'royal_bear',
    name: 'ЦАРСКАЯ ОХОТА',
    category: 'wild',
    description: 'Аристократический outdoor-стиль с лесной атмосферой, статусом и cinematic realism.',
    prompt: 'Cinematic aristocratic outdoor portrait — royal hunting aesthetic, old European tradition. Dramatic natural light through ancient forest trees, golden hour or soft overcast. Classic aristocratic hunting fashion: structured waxed jacket, quality tweed coat or hunting blazer in forest green, cognac or deep brown. Realistic tweed and waxed canvas texture — authentic fabric character, natural outdoor wear, visible fabric detail. Powerful aristocratic presence, commanding and grounded. Shot on Leica SL2, 90mm Summicron, natural light. Authentic photography — real skin, no over-retouching. Color palette: deep forest green, cognac, dark brown, golden amber, autumn earth.',
    previewUrl: royalPresenceImg
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
  'luxury_resort',         // ЗАТЕРЯННЫЙ МИР
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

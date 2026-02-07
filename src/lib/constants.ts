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

export const STYLES: Style[] = [
  // РЕАЛИЗМ - 12 стилей для Instagram фотосессий
  { 
    id: 'quiet_luxury', 
    name: 'Quiet Luxury', 
    category: 'realistic',
    description: 'Интеллектуальный минимализм', 
    prompt: 'Ultra photorealistic portrait photography. Style: Quiet Luxury intellectual minimalism. Natural soft window light, shallow depth of field. Designer neutral-tone clothing (cashmere, silk). Candid elegant pose. Shot on Sony A7R IV, 85mm f/1.4 lens. Magazine editorial quality.', 
    previewUrl: quietLuxuryImg 
  },
  { 
    id: 'intellectual_elegance', 
    name: 'Intellectual Elegance', 
    category: 'realistic',
    description: 'Европейская классика', 
    prompt: 'Photorealistic European elegance portrait. Soft golden hour lighting. Classic tailored outfit in muted tones. Thoughtful pose with natural expression. Professional fashion photography. Leica SL2, 50mm Summilux. Vogue Italia aesthetic.', 
    previewUrl: intellectualEleganceImg 
  },
  { 
    id: 'luxe_editorial', 
    name: 'Luxury Editorial', 
    category: 'realistic',
    description: 'High Fashion Editorial', 
    prompt: 'High-end fashion editorial photography. Dramatic studio lighting with soft shadows. Luxury designer clothing, unique textures. Dynamic confident pose. Shot on Phase One IQ4, Broncolor lighting. Harper\'s Bazaar quality.', 
    previewUrl: luxuryEditorialImg 
  },
  { 
    id: 'business_elite', 
    name: 'Business Elite', 
    category: 'realistic',
    description: 'Уровень Forbes', 
    prompt: 'Executive portrait photography. Clean professional lighting. Premium tailored business attire. Confident powerful stance. Modern office or neutral background. Canon EOS R5, 85mm f/1.2. Forbes cover quality.', 
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'old_money', 
    name: 'Old Money', 
    category: 'realistic',
    description: 'Тихая роскошь наследников', 
    prompt: 'Old money aesthetic portrait. Soft natural light in elegant interior. Classic understated luxury clothing (Ralph Lauren, Brunello Cucinelli style). Relaxed aristocratic pose. Film-like color grading. Hasselblad X2D quality.', 
    previewUrl: oldMoneyImg 
  },
  { 
    id: 'milano_style', 
    name: 'Milano Elegance', 
    category: 'realistic',
    description: 'Итальянский шик', 
    prompt: 'Milanese street style fashion photography. Beautiful Italian architecture background. Chic designer outfit with bold accessories. Effortlessly stylish pose. Warm Mediterranean light. Sony A1, Zeiss Batis 85mm.', 
    previewUrl: milanoEleganceImg 
  },
  { 
    id: 'parisian_chic', 
    name: 'Parisian Chic', 
    category: 'realistic',
    description: 'Французская элегантность', 
    prompt: 'Parisian effortless chic portrait. Soft diffused daylight. Classic French style clothing (Chanel, Dior inspired). Natural relaxed pose at café or street. Film photography aesthetic. Contax 645, Portra 400 look.', 
    previewUrl: parisianChicImg 
  },
  { 
    id: 'scandinavian_minimal', 
    name: 'Scandinavian Minimal', 
    category: 'realistic',
    description: 'Северный минимализм', 
    prompt: 'Scandinavian minimalist portrait. Clean white and neutral tones. Simple elegant clothing in quality fabrics. Serene contemplative expression. Soft overcast lighting. Fujifilm GFX 100S. Kinfolk magazine aesthetic.', 
    previewUrl: scandinavianMinimalImg 
  },
  { 
    id: 'new_york_power', 
    name: 'New York Power', 
    category: 'realistic',
    description: 'Нью-Йоркский стиль', 
    prompt: 'New York power dressing portrait. Urban sophisticated backdrop. Sharp tailored power suit or structured dress. Confident commanding pose. Dynamic city lighting. Nikon Z9, 70-200mm f/2.8. WSJ Magazine style.', 
    previewUrl: newYorkPowerImg 
  },
  { 
    id: 'golden_hour_glow', 
    name: 'Golden Hour Glow', 
    category: 'realistic',
    description: 'Магия золотого часа', 
    prompt: 'Golden hour portrait photography. Warm backlit sun creating rim light. Flowing elegant outfit in warm tones. Dreamy romantic atmosphere. Natural outdoor setting. Canon R5, 135mm f/1.8. Instagram influencer quality.', 
    previewUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'luxury_resort', 
    name: 'Luxury Resort', 
    category: 'realistic',
    description: 'Курортная роскошь', 
    prompt: 'Luxury resort lifestyle portrait. Bright natural light, tropical or coastal setting. Elegant resort wear or summer couture. Relaxed sophisticated pose. Vibrant but refined colors. Sony A7 IV, Zeiss 55mm f/1.8Jean.', 
    previewUrl: luxuryResortImg 
  },
  { 
    id: 'evening_glamour', 
    name: 'Evening Glamour', 
    category: 'realistic',
    description: 'Вечерний гламур', 
    prompt: 'Evening glamour portrait. Sophisticated low-key lighting with sparkle. Stunning evening gown or cocktail dress. Elegant posed shot. Jewelry catching light beautifully. Hasselblad H6D. Red carpet quality photography.', 
    previewUrl: eveningGlamourImg 
  },
  
  // ДИКИЙ СТИЛЬ - с животными
  { 
    id: 'royal_bear', 
    name: 'Royal Presence', 
    category: 'wild',
    description: 'Сила и величие', 
    prompt: 'Majestic portrait with polar bear. Photorealistic cinematic lighting. Luxurious winter couture. Powerful protective symbolism. Dramatic composition. High-end fantasy fashion photography.', 
    previewUrl: 'https://images.unsplash.com/photo-1534823983341-d4e6e4aa046c?auto=format&fit=crop&q=80&w=800' 
  }
];

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

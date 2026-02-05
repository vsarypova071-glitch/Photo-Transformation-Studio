 import { PlanType, Style, Package } from '../types';
 
 export const STYLES: Style[] = [
   { 
     id: 'quiet_luxury', 
     name: 'Quiet Luxury', 
     category: 'realistic',
     description: 'Интеллектуальный минимализм', 
     prompt: 'STYLE: Quiet Luxury. Create a photorealistic portrait in the style of intellectual minimalism and quiet luxury.', 
     previewUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'intellectual_femininity', 
     name: 'Intellectual Elegance', 
     category: 'realistic',
     description: 'Европейская классика', 
     prompt: 'Style: Quiet luxury, intellectual femininity, European classic elegance.', 
     previewUrl: 'https://images.unsplash.com/photo-1519744484402-d390a72614e1?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'luxe_editorial', 
     name: 'Luxury Editorial', 
     category: 'realistic',
     description: 'High Fashion Editorial', 
     prompt: 'Ultra-realistic high-fashion editorial.', 
     previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'business_elite', 
     name: 'Business Elite', 
     category: 'realistic',
     description: 'Уровень Forbes', 
     prompt: 'Sharp executive portrait.', 
     previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'old_money', 
     name: 'Old Money', 
     category: 'realistic',
     description: 'Тихая роскошь', 
     prompt: 'Refined aristocratic aesthetic.', 
     previewUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'milano_style', 
     name: 'Milano Elegance', 
     category: 'realistic',
     description: 'Итальянский шик', 
     prompt: 'Breathtaking Milanese luxury fashion style.', 
     previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'royal_bear', 
     name: 'Royal Presence', 
     category: 'wild',
     description: 'Защита и сила', 
     prompt: 'STYLE: Strength and Presence with majestic polar bear.', 
     previewUrl: 'https://images.unsplash.com/photo-1534823983341-d4e6e4aa046c?auto=format&fit=crop&q=80&w=800' 
   },
   { 
     id: 'futuristic_elegance', 
     name: 'FUTURISM', 
     category: 'futuristic',
     description: 'Образы из будущего', 
     prompt: 'High-end Futuristic style with nano-suit.', 
     previewUrl: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&q=80&w=800' 
   }
 ];
 
 export const PACKAGES: Package[] = [
   {
     id: PlanType.START,
     name: 'START',
     price: 199,
     credits: 5,
     stylesLimit: 2,
     description: 'Для тех, кто хочет попробовать',
     features: ['5 генераций', '2 стиля на выбор', 'Стандартная очередь']
   },
   {
     id: PlanType.PREMIUM,
     name: 'PREMIUM',
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
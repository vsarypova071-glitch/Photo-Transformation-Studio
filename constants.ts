
import { PlanType, Style, Package } from './types';

export const STYLES: Style[] = [
  // --- REALISTIC PREMIUM (12 СТИЛЕЙ) ---
  { 
    id: 'quiet_luxury', 
    name: 'Quiet Luxury', 
    category: 'realistic',
    description: 'Интеллектуальный минимализм', 
    prompt: 'STYLE: Quiet Luxury · Intellectual Minimalism. Create a photorealistic portrait in the style of intellectual minimalism and quiet luxury. Clothing: Minimalist tailoring, ivory, milk white, taupe, graphite tones. Emotional tone: Calm, intelligent, confident, composed. Identity rules: Preserve real facial proportions. Real skin texture, no artificial beautification.', 
    previewUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'intellectual_femininity', 
    name: 'Intellectual Elegance', 
    category: 'realistic',
    description: 'Европейская классика и доверие', 
    prompt: 'Style: Quiet luxury, intellectual femininity, European classic elegance. The image must feel beautiful, tasteful, and emotionally attractive. The subject looks confident, intelligent, and approachable. Clothing: Classic, timeless silhouettes, elegant fabrics. Color palette: Warm neutrals, beige, taupe, ivory, deep blue. Identity rules: Preserve real facial proportions, no idealization. Person must look dignified and authentic.', 
    previewUrl: 'https://images.unsplash.com/photo-1519744484402-d390a72614e1?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'luxe_editorial', 
    name: 'Luxury Editorial', 
    category: 'realistic',
    description: 'Обложка Harper’s Bazaar', 
    prompt: 'Ultra-realistic high-fashion editorial. Subject in a breathtaking bespoke designer outfit made of heavy structural silk. High-end studio lighting. PRESERVE ORIGINAL FACE AND SLIM ELEGANT BODY PROPORTIONS. NO PLASTIC LOOK. VOGUE QUALITY.', 
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'business_elite', 
    name: 'Business Elite', 
    category: 'realistic',
    description: 'Уровень Forbes', 
    prompt: 'Sharp executive portrait. Subject wearing a premium custom-fit Italian wool suit. Glass office background with soft bokeh. KEEP EXACT FACE WIDTH AND SLIM SILHOUETTE. REAL FABRIC TEXTURES. CENTERED.', 
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'old_money', 
    name: 'Old Money', 
    category: 'realistic',
    description: 'Тихая роскошь', 
    prompt: 'Refined aristocratic aesthetic. Subject wearing tailored cashmere and linen fabrics in cream tones. Luxury estate background. MAINTAIN ORIGINAL FACE AND GRACEFUL SLIM POSTURE. NATURAL LIGHT.', 
    previewUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'milano_style', 
    name: 'Milano Elegance', 
    category: 'realistic',
    description: 'Итальянский шик', 
    prompt: 'Breathtaking Milanese luxury fashion style. Warm golden hour lighting in a historic Italian courtyard. Subject in high-end linen and silk. Real skin texture, cinematic depth.', 
    previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'paris_chic', 
    name: 'Parisian Chic', 
    category: 'realistic',
    description: 'Французский шарм', 
    prompt: 'Elegant Parisian street style. Soft overcast daylight. Subject wearing a perfectly tailored trench coat or minimalist blazer. Artistic bokeh. High-end editorial quality.', 
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'studio_beauty', 
    name: 'Studio Beauty', 
    category: 'realistic',
    description: 'Идеальный портрет', 
    prompt: 'Minimalist luxury studio beauty shot. Soft focus background. Professional makeup and hair styling. PRESERVE FACIAL ASYMMETRY AND FEATURES. SLIM ELEGANT SHOULDERS. HIGH-END RETOUCHING.', 
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'cinematic_portrait', 
    name: 'Cinematic Portrait', 
    category: 'realistic',
    description: 'Кадр из кино', 
    prompt: 'Hyper-realistic cinematic film still. Subject in a tailored evening outfit. Dramatic rim lighting, expensive film grain. Realistic skin texture. NO CGI FEEL. PRESERVE FACE AND BODY WEIGHT.', 
    previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'vogue_high_fashion', 
    name: 'High Fashion Vogue', 
    category: 'realistic',
    description: 'Авангардный люкс', 
    prompt: 'Avant-garde fashion photography. Subject wearing an intricate structural gown or suit with metallic textures. Strong artistic lighting. SLIM FEMININE SILHOUETTE. PRESERVE IDENTITY.', 
    previewUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'elegant_evening', 
    name: 'Elegant Evening', 
    category: 'realistic',
    description: 'Вечерний выход', 
    prompt: 'Breathtaking evening gala look. Subject in a fluid silk velvet dress/suit. Grand staircase background. Cinematic lighting piercing through the scene. PRESERVE SLIM PROPORTIONS AND FACE.', 
    previewUrl: 'https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?auto=format&fit=crop&q=80&w=800' 
  },
  { 
    id: 'city_chic', 
    name: 'Outdoor City Chic', 
    category: 'realistic',
    description: 'Уличный стиль Милана', 
    prompt: 'Premium street style in Milan. Subject wearing a high-end trench coat and designer accessories. Beautiful urban background with sun flare. SLIM ELEGANT BODY. PRESERVE FACE FEATURES.', 
    previewUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800' 
  },

  // --- СИЛА / PRESENCE ---
  { 
    id: 'royal_bear', 
    name: 'Royal Presence', 
    category: 'wild',
    description: 'Защита и спокойная сила', 
    prompt: 'STYLE: Strength and Presence. Generate a photorealistic cinematic scene with a human and a huge majestic white polar bear next to each other. The bear looks strong, calm, and protective, standing impressively massive in a snowy landscape. Environment: arctic ice fields or snowy mountains. Mood: strong, calm, protective, massive, pure white power.', 
    previewUrl: 'https://images.unsplash.com/photo-1534823983341-d4e6e4aa046c?auto=format&fit=crop&q=80&w=800' 
  },

  // --- FUTURISM ---
  { 
    id: 'futuristic_elegance', 
    name: 'FUTURISM', 
    category: 'futuristic',
    description: 'Образы из далекого будущего', 
    prompt: 'High-end Futuristic Futurism. Subject wearing a bespoke advanced nano-suit with liquid metal textures, pulsating bioluminescent nodes, and iridescent carbon-fiber structural elements. The suit is a masterpiece of technological design. Photorealistic, cinematic lighting with sharp reflections and deep shadows. PRESERVE FACE IDENTITY AND SLIM ELEGANT BODY FRAME.', 
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

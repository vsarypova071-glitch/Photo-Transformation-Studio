// Wardrobe + buildPrompt — взяты из supabase/functions/generate-one/index.ts
// чтобы у Beget single-generation был такой же визуальный стиль, как сейчас.

const WARDROBE: readonly string[] = [
  'custom tailored minimalist wool suit in deep navy',
  'bespoke structured blazer in forest green premium cashmere',
  'silk blouse in ivory with high-waist charcoal trousers',
  'architectural couture coat in camel',
  'luxury power suit in slate gray, precision tailoring',
  'oversized cashmere coat in off-white, The Row aesthetic',
  'structured leather blazer in cognac brown',
  'silk midi dress in deep burgundy with architectural draping',
  'wide-leg trousers in charcoal with ivory cashmere turtleneck',
  'blazer dress in midnight blue, sharp structured shoulders',
];

function pickGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

// Ключевые слова lifestyle/kids стилей. Совпадение → editorial-блоки отключаются.
// Список намеренно консервативный: неизвестные стили получают editorial по умолчанию.
const LIFESTYLE_KEYWORDS: readonly string[] = [
  'kids', 'children', 'child', 'toddler', 'baby', 'newborn',
  'family', 'cozy', 'casual everyday', 'home',
  'дет', 'ребен', 'малыш', 'семей', 'домашн',
];

// Определяет, нужны ли fashion/editorial блоки для данного стиля.
// Приоритет: явный styleCategory > keyword detection по stylePrompt > default editorial.
function detectIsEditorial(
  stylePrompt: string,
  styleCategory?: 'editorial' | 'lifestyle',
): boolean {
  if (styleCategory === 'editorial') return true;
  if (styleCategory === 'lifestyle') return false;
  // Fallback: ищем lifestyle-маркеры в тексте промпта (без учёта регистра).
  const lower = stylePrompt.toLowerCase();
  return !LIFESTYLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface BuildPromptInput {
  stylePrompt: string;
  customPrompt?: string;
  isFullBody?: boolean;
  aspectRatio?: string;
  // Необязательный override категории. Если не передан — auto-detect по stylePrompt.
  // Шаг B (позже): generation.ts будет слать это поле явно.
  styleCategory?: 'editorial' | 'lifestyle';
}

// [NEGATIVE PROMPT] — встраивается в конец buildPrompt() как раздел AVOID:.
// Отдельной функцией, чтобы можно было переиспользовать или расширять независимо.
export function buildNegativePrompt(): string {
  return [
    'plastic skin', 'wax face', 'mannequin', 'doll-like face', 'dead eyes',
    'blank stare', 'CGI', '3D render', 'over-smoothed skin', 'airbrushed skin',
    'flawless artificial face', 'beauty filter', 'fake face', 'altered identity',
    'changed face structure', 'passport photo look', 'stiff pose',
    'artificial smile', 'synthetic portrait', 'uncanny valley',
    'overly glossy commercial retouching',
    'centered static pose', 'HR portrait framing', 'passport composition',
    'flat even studio lighting',
    'generic office shoes', 'stiff mannequin posture', 'static fashion pose',
    'influencer glamour aesthetic', 'over-styled CGI fashion',
  ].join(', ');
}

export function buildPrompt(input: BuildPromptInput): string {
  const fullBodyHint = input.isFullBody
    ? 'Full body composition: include subject from head to feet.'
    : 'Portrait composition: head and shoulders, magazine cover style.';

  // Определяем режим один раз — используется для условных блоков ниже.
  const isEditorial = detectIsEditorial(input.stylePrompt, input.styleCategory);

  // ── ГЛОБАЛЬНЫЕ БЛОКИ (применяются ко всем стилям) ─────────────────────────

  // [REFERENCE IMAGE] — напоминание модели использовать загруженное фото как
  // первичный визуальный источник личности, а не только как текстовое описание.
  const referenceBlock = `\
Use the uploaded reference photo as the PRIMARY identity source. \
The attached image defines who this person is — match their face exactly.`;

  // [IDENTITY] — строгое сохранение лица, структуры, возраста и индивидуальности.
  // Запрещает любую «улучшающую» обработку, которая убирает индивидуальность.
  const identityBlock = `\
IDENTITY PRESERVATION (strict):
- Do not alter facial structure, face shape, nose, lips, eyes, jawline, or cheekbones.
- Do not change age, natural asymmetry, or distinguishing personal features.
- Do not beautify, idealize, or make the person look like a model unless explicitly requested.
- The person must be immediately recognizable as the same individual from the reference photo.
- Preserve the subject's natural eye openness and alertness exactly as in the reference.
- Do not add artificial eyelid heaviness, drooping, or tired-eye effect.
- Preserve the natural energy and sharpness of the gaze — eyes should look open and alive.
- Do not make the subject appear older, fatigued, or emotionally flattened.
- Keep realistic anatomy without beautification or cosmetic enhancement.`;

  // [REALISM] — живость кожи, выразительность глаз, натуральная мимика.
  // Противодействует эффекту манекена и CGI-рендера.
  const realismBlock = `\
REALISM (natural photo):
- Eyes must be expressive and alive: realistic catchlights, natural wet sheen, visible depth and iris detail.
- Skin: keep natural micro-texture, subtle visible pores, soft realistic shadows. No airbrushing or smoothing.
- Expression: natural, human, emotionally present. Avoid blank stare, static frozen face, or artificial smile.
- Lighting: soft cinematic natural light with believable environmental shadows and realistic lens depth.
- Final result must look like a real candid editorial photograph — not CGI, not a render, not a wax figure.`;

  // ── EDITORIAL БЛОКИ (только для взрослых business/luxury/fashion стилей) ──

  // [EDITORIAL PHOTOGRAPHY] — cinematic posing, fashion-framing и editorial-энергия.
  // Все fashion-термины сопровождаются realistic-qualifier'ами, чтобы не спровоцировать
  // возврат к airbrushed/mannequin результату.
  const editorialBlock = `\
EDITORIAL PHOTOGRAPHY (realistic):
- Shoot this as a working professional photographer — not a formal portrait sitting.
- Posing: dynamic and natural. Subtle weight shift, relaxed asymmetry in shoulders and stance.
  Organic confident body language — the subject is caught in a real moment, not posed for a passport.
- Composition: off-center framing, fashion rule-of-thirds, interesting negative space.
  Avoid symmetric centered headshot. Avoid flat HR portrait composition.
- Depth of field: shallow, gentle background separation, realistic lens compression (85–135mm feel).
- Lighting: professional but believable — soft window light, golden hour, or studio with natural falloff.
  No flat even studio lighting.
- Atmosphere: luxury editorial photoshoot energy. Vogue / Harper's Bazaar realistic visual language.
  Stylish and premium — but shot on a real camera, by a real photographer, in a real candid moment.`;

  // [FASHION CONSISTENCY] — когерентность образа: обувь, аксессуары, стайлинг.
  // Не усиливает glamour — требует реалистичного, носибельного премиум-образа.
  const fashionBlock = `\
FASHION CONSISTENCY:
- Footwear must match the premium editorial styling: elegant modern shoes with refined silhouette.
  No generic office shoes, flat casual loafers, or low-detail random footwear.
- Full outfit styling should feel cohesive, intentional, and fashion-directed —
  as if curated by a stylist for a real luxury campaign.
- Clothing and accessories must read as realistic and wearable, not hyper-stylized or costume-like.
  Premium but believable.`;

  // [MOVEMENT & CANDID ENERGY] — живость позинга, органичность тела, ощущение момента.
  // Противодействует статичным симметричным позам без уклона в theatrics.
  const candorBlock = `\
MOVEMENT & CANDID ENERGY:
- The subject should feel caught mid-moment during a professional photoshoot,
  not frozen in a posed position.
- Natural body language: subtle walking motion, relaxed weight shift,
  organic hand interaction with environment or clothing.
- Confidence without stiffness. Elegance without rigidity. Alive without theatrics.
- Avoid mannequin-like symmetry, stiff posture, and static fashion pose.`;

  // [CHILD LIFESTYLE PHOTOGRAPHY] — candid energy для детских и семейных стилей.
  // Зеркалит editorial-layer по назначению, но без luxury/fashion и с акцентом
  // на детскую спонтанность и семейную теплоту. Активен только если isEditorial = false.
  const childLifestyleBlock = `\
CHILD & FAMILY LIFESTYLE PHOTOGRAPHY:
- Natural, candid, lifestyle photography feeling — not a studio session.
- Children and family members should look alive, emotionally present, and in motion.
- Posing: relaxed and spontaneous. Natural weight shift, playful movement,
  organic body language. Children caught mid-laugh, mid-run, mid-interaction.
- Expression: genuine curiosity, warmth, laughter, natural childhood energy.
  No blank stare, no frozen smile, no formal sitting pose.
- Composition: warm lifestyle framing. Soft rule-of-thirds, natural negative space.
  Avoid symmetric centered school-portrait composition.
- Lighting: soft natural daylight, golden hour, or warm indoor ambient light.
  No flat harsh studio lighting.
- Atmosphere: family-photo warmth and emotional authenticity.
  Real moment — not a fashion shoot, not a commercial campaign.`;

  // [AVOID] — встроенный negative prompt. Gemini/OpenRouter не принимает
  // отдельное поле negative_prompt, поэтому список запретов идёт в текст.
  // Lifestyle/kids добавляет свои специфичные термины поверх базового списка.
  const lifestyleAvoidExtra = ', adult fashion pose, luxury glamour child model, stiff school portrait, mannequin child pose';
  const avoidBlock = `AVOID: ${buildNegativePrompt()}${isEditorial ? '' : lifestyleAvoidExtra}`;

  return [
    // ── Глобальные блоки ──────────────────────────────────────────────────────
    referenceBlock,
    '',
    identityBlock,
    '',
    realismBlock,
    '',
    // ── Editorial-only блоки (isEditorial = false → не включаются) ────────────
    ...(isEditorial
      ? [editorialBlock, '', fashionBlock, '', candorBlock, '']
      : [childLifestyleBlock, '']),
    // ── Состав и технические параметры ───────────────────────────────────────
    fullBodyHint,
    ...(isEditorial ? [`OUTFIT: ${pickGarment()}.`] : []),
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    input.customPrompt ? `Additional note: ${input.customPrompt}` : '',
    '',
    // ── Глобальный AVOID ──────────────────────────────────────────────────────
    avoidBlock,
  ].filter(Boolean).join('\n');
}

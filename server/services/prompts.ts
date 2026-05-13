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

export interface BuildPromptInput {
  stylePrompt: string;
  customPrompt?: string;
  isFullBody?: boolean;
  aspectRatio?: string;
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
  ].join(', ');
}

export function buildPrompt(input: BuildPromptInput): string {
  const garment = pickGarment();
  const fullBodyHint = input.isFullBody
    ? 'Full body composition: include subject from head to feet.'
    : 'Portrait composition: head and shoulders, magazine cover style.';

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
- The person must be immediately recognizable as the same individual from the reference photo.`;

  // [REALISM] — живость кожи, выразительность глаз, натуральная мимика.
  // Противодействует эффекту манекена и CGI-рендера.
  const realismBlock = `\
REALISM (natural photo):
- Eyes must be expressive and alive: realistic catchlights, natural wet sheen, visible depth and iris detail.
- Skin: keep natural micro-texture, subtle visible pores, soft realistic shadows. No airbrushing or smoothing.
- Expression: natural, human, emotionally present. Avoid blank stare, static frozen face, or artificial smile.
- Lighting: soft cinematic natural light with believable environmental shadows and realistic lens depth.
- Final result must look like a real candid editorial photograph — not CGI, not a render, not a wax figure.`;

  // [EDITORIAL PHOTOGRAPHY] — добавляет cinematic posing, fashion-framing и
  // editorial-энергию ПОСЛЕ identity/realism блоков. Идёт третьим, чтобы модель
  // сначала зафиксировала личность и реализм, и только потом получила aesthetic-
  // инструкции. Все fashion-термины сопровождаются realistic-qualifier'ами, чтобы
  // не спровоцировать возврат к airbrushed/mannequin результату.
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

  // [AVOID] — встроенный negative prompt. Gemini/OpenRouter не принимает
  // отдельное поле negative_prompt, поэтому список запретов идёт в текст.
  const avoidBlock = `AVOID: ${buildNegativePrompt()}`;

  return [
    referenceBlock,
    '',
    identityBlock,
    '',
    realismBlock,
    '',
    editorialBlock,
    '',
    fullBodyHint,
    `OUTFIT: ${garment}.`,
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    input.customPrompt ? `Additional note: ${input.customPrompt}` : '',
    '',
    avoidBlock,
  ].filter(Boolean).join('\n');
}

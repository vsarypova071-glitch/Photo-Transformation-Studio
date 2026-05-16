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
    'fashion model face', 'runway model transformation', 'beauty-face geometry',
    'altered facial proportions', 'editorial face reinterpretation', 'stylized facial anatomy',
    // Magnetism / femininity
    'duck lips', 'exaggerated seduction', 'artificial sexiness', 'emotionally empty posing',
    'escort aesthetic', 'vulgar glamour', 'nightclub energy', 'cheap luxury',
    // Anti-cheap luxury
    'flashy rich aesthetic', 'fake billionaire visuals', 'gold overload', 'casino luxury',
    'fast fashion energy', 'hypersexual styling',
    // Eye contact
    'empty model stare', 'constant side-looking editorial pose', 'emotionless beauty shot',
    // Cinematic realism
    'plastic beauty', 'fake perfection', 'synthetic lighting', 'AI glamour',
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
- Keep realistic anatomy without beautification or cosmetic enhancement.
- Preserve the exact face proportions and vertical facial structure.
- Preserve the subject's natural face length and jawline shape.
- Do not widen, shorten, soften, or round the face shape.
- Preserve natural cheek volume distribution and facial proportions from the reference image.
- Avoid artificial facial softening or generalized beauty-face geometry.
FACIAL GEOMETRY LOCK:
- Preserve exact inter-eye distance from reference image.
- Preserve exact upper-face and lower-face proportions.
- Preserve exact facial width-to-height ratio.
- Preserve exact cheek structure and jaw proportions.
- Preserve the natural oval facial silhouette from the reference.
- Do not reinterpret facial anatomy for editorial aesthetics.
- Do not transform the subject into a fashion-model facial structure.
- Face identity accuracy is MORE important than cinematic styling.`;

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

  // [AURA FIRST] — главная директива: эмоциональный приоритет над деталями.
  // Устанавливает, что fashion/environment = инструменты ауры, а не цель сами по себе.
  const auraBlock = `\
LUXURY AURA FIRST (primary directive):
The primary purpose of this image is to communicate luxury aura, status, and cinematic presence.
Before the viewer notices any outfit detail, they must FEEL one of these:
wealth, exclusivity, power, elegance, or desire.

Fashion, environment, and color are instruments in service of this feeling — they are NOT the subject.

Priority hierarchy:
1. AURA & PRESENCE — the magnetic quality and status that radiates from this person
2. CINEMATIC ATMOSPHERE — the world she inhabits feels rare, exclusive, expensive
3. LIGHT & SHADOW — sculpts, elevates, and creates emotional depth
4. FASHION & ENVIRONMENT — chosen to amplify the aura, never to compete with it

If the viewer's first reaction is "beautiful outfit" — the image has failed.
If their first reaction is "who IS this woman?" — the image has succeeded.`;

  // [LUXURY ADAPT] — определяет luxury-архетип человека из reference, затем использует
  // внешность как инструмент калибровки (цвет, свет, среда). Аура первична — детали вторичны.
  const luxuryAdaptBlock = `\
APPEARANCE-DRIVEN LUXURY ARCHETYPE:
Identify this woman's natural luxury archetype from the reference photo.
Then choose ALL styling instruments — color, light, environment, fashion — to amplify that specific archetype.

Step 1 — Identify her aura archetype:
- Power she projects (grace / authority / mystery / desire / freedom / intelligence / sensuality)
- Luxury world she belongs to (old money / modern power / romantic / adventurous / avant-garde)
- Emotional note the viewer should feel (awe / respect / desire / intrigue / warmth)

Step 2 — Use appearance as instrument calibration:
- Hair color and tone → color palette that harmonizes, never forces conflict.
  Warm golden → camel, ivory, champagne, cognac. Cool/fair → steel, ice, navy, white, silver.
  Deep warm → chocolate, forest, burgundy, amber. Dark hair/cool → midnight, black, ivory, silver.
- Skin tone and facial energy → lighting that sculpts and flatters her specific structure.
  (Warm skin → golden light. Cool skin → silver-blue. Angular structure → directional shadow.)
- Her archetype → environment she OWNS, not merely visits.

Result: every visual element — light, fabric, room, shadow — says one coherent thing about this woman.`;

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
  Premium but believable.
- Fashion serves the aura — the outfit should deepen the viewer's sense of WHO SHE IS, not distract from it.`;

  // [NATURAL PORTRAIT PRESENCE] — уверенная осанка без runway/walking энергии.
  // Walking motion провоцировал уход лица в "fashion campaign human" геометрию.
  const candorBlock = `\
NATURAL PORTRAIT PRESENCE:
- Natural relaxed posture with subtle asymmetry.
- Calm confident presence.
- Realistic portrait-session body language.
- Subject may stand naturally or interact subtly with environment,
  but should NOT appear to walk, stride, or perform runway movement.
- Avoid exaggerated editorial motion or fashion-walk energy.`;

  // ── PREMIUM EMOTIONAL DIRECTION БЛОКИ (editorial-only) ──────────────────────

  const magnetismBlock = `\
MAGNETIC PRESENCE:
The woman feels emotionally powerful, calm and magnetic.
She does not try to attract attention aggressively — her presence naturally draws it.
Expression: confident, emotionally composed, subtle mystery, calm sensuality, quiet power, elegant restraint.
The magnetism comes from eye contact, posture, silence, confidence, and cinematic emotional depth.
Avoid: exaggerated seduction, influencer facial expressions, duck lips, artificial sexiness, emotionally empty fashion posing.`;

  const femininityBlock = `\
HIGH VALUE FEMININITY:
The woman feels expensive, emotionally unavailable, elegant, self-sufficient, desired but unattainable.
Luxury femininity is expressed through restraint, confidence, subtle emotion, graceful body language, premium styling, calm emotional control.
Avoid: escort aesthetic, vulgar glamour, cheap luxury, nightclub energy, explicit sexuality, excessive body exposure.`;

  const eyeContactBlock = `\
EYE CONTACT & EMOTION:
Eyes must feel alive, intelligent and emotionally present.
Use: direct eye contact, calm observational gaze, cinematic candid moments, subtle emotional tension.
Avoid: mannequin expressions, empty model stare, constant side-looking editorial poses, emotionless beauty shots.
The viewer should feel: "she has an inner world."`;

  const cinematicRealismBlock = `\
CINEMATIC REALISM:
Every image must feel like a frame from a premium cinematic universe — not an AI-generated fashion render.
Preferred: realistic skin texture, natural asymmetry, believable movement, cinematic light, emotional realism, Vogue / Netflix luxury atmosphere.
Avoid: overprocessed skin, plastic beauty, fake perfection, synthetic lighting, AI glamour clichés.`;

  const antiCheapBlock = `\
ANTI-CHEAP LUXURY:
Luxury must feel quiet, restrained, editorial, cinematic, emotionally intelligent, timeless.
Avoid: flashy rich aesthetics, fake billionaire visuals, gold overload, casino luxury, cheap glamour, influencer posing, fast fashion energy, hypersexual styling.`;

  const antiRepetitionBlock = `\
ANTI-REPETITION:
Avoid repeating identical poses, identical framing, identical facial expressions, identical outfit structures, repeated compositions, repeated lighting schemes.
Each image should feel like a different moment from the same luxury cinematic universe.`;

  // ── СТИЛЬ-СПЕЦИФИЧНЫЕ БЛОКИ (детектируются по ключевым словам в stylePrompt) ─

  // FUTURE LUXURY — активируется для МИР БУДУЩЕГО и других sci-fi / future стилей.
  const isFutureLuxury = isEditorial &&
    /future|futurist|sci-fi|scifi|neon|cyberpunk|architectural.*tech|МИР БУДУЩЕГО/i.test(input.stylePrompt);

  const futureLuxuryBlock = `\
FUTURE LUXURY:
Future aesthetics must feel elegant, architectural, wealthy, cinematic, emotionally sophisticated.
Preferred inspiration: Dubai elite, chrome minimalism, luxury skyscrapers, sculptural fashion, future haute couture.
Avoid: cyberpunk clichés, latex fetish aesthetics, gamer visuals, sci-fi cosplay, neon overload.`;

  // WILD LUXURY — активируется для ЦАРСКАЯ ОХОТА, ДИКАЯ ПРИРОДА и wild/nature стилей.
  const isWildLuxury = isEditorial &&
    /wild|panther|wolf|lion|horse|royal.*bear|bear|forest|nature|охот|царск|WILD/i.test(input.stylePrompt);

  const wildLuxuryBlock = `\
CINEMATIC WILD LUXURY:
CONCEPT: A woman beside the enormous power of nature — not fantasy, not survival, but emotional mastery.
The subject is elegant, expensive, emotionally composed, magnetic, cinematic.
The animal is a cinematic presence: giant white wolf, majestic black panther, powerful lion,
cinematic horse, elegant luxury dogs, or other symbolic wild animal.

ANIMAL DIRECTION:
- Animals must appear large, majestic, emotionally present, cinematic, realistic.
- They are symbols of power and freedom — not pets, not zoo animals, not props.
- The connection between woman and animal feels authentic, calm, emotionally powerful.
- Animals must be rendered with premium photographic realism — no cartoon or fantasy rendering.

VISUAL ATMOSPHERE:
- Golden hour light, cinematic fog, luxury safari landscape, mountain wilderness,
  northern forests, expensive nature aesthetic.
- Flowing fabrics catching natural wind. Calm emotional power.
- Premium fashion photography quality: composition, lighting, depth of field.
- Nature feels expensive — remote, untouched, cinematic.

WHAT TO AVOID:
- Dinosaurs, fantasy monsters, mythological creatures.
- Zoo aesthetic, cage, enclosure backgrounds.
- Cartoon or illustrated animal rendering.
- Survival aesthetic, adventure-camp energy.
- Cheap jungle look, chaotic action scenes.
- Aggressive attack postures or dangerous compositions.
- Cosplay, fantasy warrior aesthetic.`;

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
      ? [
          auraBlock, '',
          luxuryAdaptBlock, '',
          editorialBlock, '',
          fashionBlock, '',
          candorBlock, '',
          magnetismBlock, '',
          femininityBlock, '',
          eyeContactBlock, '',
          cinematicRealismBlock, '',
          antiCheapBlock, '',
          antiRepetitionBlock, '',
          ...(isFutureLuxury ? [futureLuxuryBlock, ''] : []),
          ...(isWildLuxury ? [wildLuxuryBlock, ''] : []),
        ]
      : [childLifestyleBlock, '']),
    // ── Состав и технические параметры ───────────────────────────────────────
    fullBodyHint,
    ...(isEditorial ? [`OUTFIT INSPIRATION: ${pickGarment()} — adapt colorway and silhouette to harmonize with the subject's natural coloring and the style direction.`] : []),
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    input.customPrompt ? `Additional note: ${input.customPrompt}` : '',
    '',
    // ── Глобальный AVOID ──────────────────────────────────────────────────────
    avoidBlock,
  ].filter(Boolean).join('\n');
}

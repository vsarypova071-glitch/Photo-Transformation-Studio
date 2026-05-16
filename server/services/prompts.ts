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
    'different person', 'generic AI face', 'changed facial proportions', 'wrong eye spacing',
    'distorted face', 'AI doll face',
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
- Do not beautify, idealize, or transform the person into a fashion-model archetype.
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
FACE GEOMETRY LOCK (copy exactly from reference — every item):
- Inter-eye distance: exact same spacing as in the reference image.
- Eye shape: exact eyelid contour, eye size, natural openness.
- Eye color: preserve natural iris color and pattern exactly.
- Eye placement: exact vertical and horizontal position within face.
- Brow shape, thickness, arch, and position — identical to reference.
- Nose shape, nose width, bridge height, and tip form — identical to reference.
- Lip shape, fullness, cupid's bow, and mouth width — identical to reference.
- Cheekbone position and volume — identical to reference.
- Facial oval and face silhouette — preserve natural contour.
- Jawline shape and definition — identical to reference.
- Chin shape and projection — identical to reference.
- Age: preserve the subject's exact visible age — do not rejuvenate or age the face.
- Ethnicity and natural skin undertone — do not generalize or Westernize features.
- Natural face proportions — do not reinterpret for editorial aesthetics.
- Face identity accuracy is MORE important than cinematic styling.
ALLOWED grooming (enhances without altering the person):
- Style-appropriate makeup applied naturally over the real face.
- Neat, styled hairstyle matching the editorial direction.
- Beautiful realistic skin — natural texture, healthy glow, no plastic smoothing.
FORBIDDEN: changing facial anatomy, creating a fashion-model version of this face,
smoothing away natural asymmetry, generalizing ethnic features,
replacing the face with a different-looking person.`;

  // [REALISM] — живость кожи, выразительность глаз, натуральная мимика.
  // Противодействует эффекту манекена и CGI-рендера.
  const realismBlock = `\
REALISM (natural photo):
- Eyes must be expressive and alive: realistic catchlights, natural wet sheen, visible depth and iris detail.
- Skin: keep natural micro-texture, subtle visible pores, soft realistic shadows. No airbrushing or smoothing.
- Expression: natural, human, emotionally present. Avoid blank stare, static frozen face, or artificial smile.
- Lighting: soft cinematic natural light with believable environmental shadows and realistic lens depth.
- Final result must look like a real candid editorial photograph — not CGI, not a render, not a wax figure.`;

  // [FULL BODY FACE LOCK] — усиленный блок при full-body режиме.
  // При дальней дистанции кадра лица дрейфуют к generic/doll. Этот блок предотвращает это.
  const fullBodyFaceLockBlock = `\
FULL BODY FACE IDENTITY LOCK (reinforced):
In full-body framing, faces are rendered smaller and drift toward generic or doll-like appearance.
This MUST be prevented. The face in full-body must be the same person as the reference photo.

FACE AT FULL-BODY DISTANCE:
- High facial consistency: the face must be recognizable as the exact same person from the reference.
- Preserve exact eye spacing — inter-eye distance must match the reference at any frame scale.
- Preserve exact eye shape, eye color, iris pattern — do not simplify or generalize.
- Preserve exact eye placement within the face — vertical and horizontal position.
- Preserve brow shape, arch, thickness, position — identical to reference.
- Preserve nose shape, width, bridge, tip — do not soften at any size.
- Preserve lip shape, fullness, cupid's bow — identical to reference.
- Preserve cheekbone position and volume — identical to reference.
- Preserve jaw shape and chin form — no softening at full-body scale.
- Preserve face oval and facial silhouette — natural contour from reference.
- Preserve the subject's exact age — do not rejuvenate the face.
- Preserve ethnicity and natural skin undertone — do not generalize features.
- Do not switch to a generic editorial-model face because the face is smaller in frame.

BODY TYPE PRESERVATION:
- Preserve the subject's natural body type and proportions from the reference photo.
- Preserve realistic body structure — do not alter the person's actual build.
- Preserve natural weight appearance — do not slim down or enlarge the body.
- Head size: anatomically correct relative to body — standard human head-to-body ratio.
- Shoulder width, waist, hip proportions: natural — do not distort or idealize.
- Leg and torso proportions: realistic — no fashion-model elongation.
- Body language: natural, elegant, grounded — not mannequin-stiff or doll-posed.

ALLOWED:
- Beautiful realistic skin, natural cinematic glow.
- Style-appropriate makeup, elegant hairstyle.
- Cinematic lighting that flatters without distorting.

FORBIDDEN in full-body mode:
- Tiny head: head rendered too small relative to body.
- Face replacement: different-looking person's face due to smaller face size in frame.
- Body slimming or body enlargement — preserve the real person's body type.
- Unrealistic skinny waist, exaggerated slim body, oversized curves, fitness-model body swap.
- Doll anatomy: plastic proportions, fake silhouette, porcelain skin.
- Limb distortion: elongated legs, impossibly narrow waist, altered anatomy.
- Mannequin appearance, body distortion, doll posture.`;

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

  // ТИХАЯ РОСКОШЬ / OLD MONEY LIFESTYLE — quiet luxury, old money estate. Активен для editorial стилей.
  const isOldMoneyEstate = isEditorial &&
    /ТИХАЯ РОСКОШЬ|тихая.*роскошь|quiet.*luxury.*lifestyle|old.*money.*lifestyle/i.test(input.stylePrompt);

  // WILD LUXURY — активируется для ДИКАЯ ПРИРОДА и wild/nature стилей.
  // Не активируется для ТИХАЯ РОСКОШЬ (old money lifestyle).
  const isWildLuxury = isEditorial && !isOldMoneyEstate &&
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

  const oldMoneyEstateBlock = `\
QUIET LUXURY LIFESTYLE:
CONCEPT: Modern old money aesthetic — calm, expensive, naturally elegant.
Not flashy, not performative. Quietly wealthy. Effortlessly cinematic.
The woman embodies European luxury lifestyle: intelligent, composed, expensive.

SCENE VARIETY (vary across generations):
- Luxury countryside hotel exterior and golden terrace
- European streets with warm autumn light
- Premium breakfast terrace, morning coffee moment
- Countryside weekend — horses, labradors, golden retrievers as elegant companions
- Golf club or horse club atmosphere
- Luxury car moment (Range Rover, countryside road)
- Dog walking in elegant park or estate grounds
- Cashmere coat, countryside walk, golden hour light
- Luxury travel lifestyle, premium hotel lounge

WARDROBE:
- Cashmere, wool, premium tailoring, luxury casual elegance
- Quiet luxury palette: cream, camel, espresso, olive, ivory, beige, dark brown, soft black
- No visible logos, no streetwear, no party dressing
- Expensive simplicity — Ralph Lauren / Loro Piana / Armani countryside mood

VISUAL ATMOSPHERE:
- Soft golden-hour light, morning mist, warm autumn tones
- Realistic catchlight in eyes, natural skin tones, cinematic natural shadows
- Expensive calm atmosphere — real wealth, not Instagram lifestyle performance
- Premium editorial composition, luxury magazine visual language

WOMAN'S ENERGY:
- Naturally elegant, emotionally composed, subtle confidence
- Intellectual warmth, alive eyes — not empty AI stare
- No influencer posing, no performative luxury, no fashion-walk energy

WHAT TO AVOID:
- Castles dominating the frame, historical costumes, royal cosplay
- Hunting weapons, trophies, fantasy aristocracy
- Cheap glamour, influencer posing, oversexualized styling
- AI mannequin face, plastic skin
- Flashy logos, nouveau riche aesthetic, gold overload
- Fitness model energy, fashion editorial overload`;

  // БОГИНЯ / GODDESS — luxury cinematic goddess aesthetic. Активен для editorial стилей.
  const isGoddess = isEditorial &&
    /БОГИНЯ|богин|goddess|GODDESS|intellectual.*elegance/i.test(input.stylePrompt);

  const goddessBlock = `\
GODDESS LUXURY EDITORIAL:
CONCEPT: A powerful, feminine, cinematic presence in luxury settings.
Not a temple goddess — a real woman who embodies divine feminine energy
through quiet luxury, editorial composition, and cinematic atmosphere.

SCENE VARIETY (must change across every generation — never repeat):
- Sea villa terrace with Mediterranean light
- Luxury yacht deck, golden sea horizon
- Marble terrace of a luxury resort
- Infinity pool overlooking Mediterranean coast
- European luxury hotel interior, architectural hallway
- Private mansion salon with tall windows and soft light
- Sunset on a luxury estate terrace
- Coastal cliffside with flowing fabrics and warm wind
- Luxury resort garden, blooming flowers, premium architecture
- Interior of a luxury suite — mirrors, candles, rich textures

WARDROBE:
- Flowing silk dresses in white, cream, ivory, gold, soft beige
- Couture-inspired silhouettes — draped, elegant, sculptural
- Minimal luxury jewelry: fine gold, diamonds, delicate chains
- Premium neutral palette — no fast fashion, no streetwear, no costume look
- Every outfit must feel like a luxury fashion campaign editorial

VISUAL ATMOSPHERE:
- Rich warm golden-hour light, Mediterranean sunset glow
- Soft cinematic wind through flowing fabric
- Premium color grading — warm tones, cinematic depth, rich shadows
- Natural realistic skin texture — no plastic, no airbrushing
- Shallow depth of field, luxury fashion photography composition
- Expensive architecture framing the subject

WOMAN'S ENERGY:
- Powerful, elegant, emotionally composed
- Natural confident posing — never stiff or theatrical
- Gaze: intense, intelligent, quietly magnetic
- She owns the space she inhabits — effortlessly, not performatively

WHAT TO AVOID:
- Ancient temples or ruins dominating the frame
- Medieval fantasy, game aesthetic, cosplay, armor
- Cheap princess look or fairytale fantasy
- Plastic AI skin, wax face, synthetic beauty
- Same location repeated across images
- Same dress silhouette repeated
- Generic white-column temple backgrounds
- Theatrical "goddess pose" frozen stiffness`;

  // ELITE SPORT — активируется для ЭЛИТНЫЙ СПОРТ и luxury fitness стилей.
  const isEliteSport = isEditorial &&
    /elite.sport|ЭЛИТНЫЙ СПОРТ|luxury.*fitness|luxury.*gym|luxury.*sport|fitness.*luxury|sport.*luxury|athletic.*luxury|luxury.*wellness|luxury.*tennis|luxury.*pilates/i.test(input.stylePrompt);

  const eliteSportBlock = `\
LUXURY SPORT EDITORIAL:
CONCEPT: Elite performance lifestyle — not fitness influencer, not gym selfie, but luxury athletic culture.
The woman feels expensive, disciplined, powerful, feminine, cinematic.

SCENE VARIETY (use different scenarios across images):
- Workout in panoramic luxury gym with city views
- Tennis club elegant portrait
- Pilates in marble wellness studio
- Yoga in luxury light-filled space
- Boxing with elegance and composure
- Treadmill by floor-to-ceiling windows
- Stretching in luxury wellness lounge
- Sporty editorial portrait in premium activewear

ENVIRONMENT:
- Luxury gyms, marble interiors, panoramic city views
- Private fitness clubs, tennis club aesthetic
- Premium wellness spaces with cinematic light
- Calm, expensive, architectural spaces

WOMAN'S ENERGY:
- Athletic luxury: strong but elegant, confident but composed
- Feminine but powerful — discipline expressed through calm control
- Premium activewear — Armani sport aesthetic, luxury sportswear
- Cinematic emotional presence — not performing for camera, just living her life

WHAT TO AVOID:
- Cheap fitness influencer aesthetic
- Neon gym lighting
- Selfie vibe or social media fitness energy
- Instagram fitness model expressions
- Vulgar sportswear or bodybuilding aesthetic
- Aggressive macho gym mood
- Glossy fitness magazine cheese`;

  // SOCIAL PORTRAIT / ИДЕАЛЬНЫЙ КАДР — чистый authentic portrait для соцсетей и личного бренда.
  // Отключает тяжёлые luxury-editorial блоки (aura, fashion, magnetism, femininity, antiCheap).
  // Сохраняет: identity, realism, editorialBlock (композиция), candorBlock, eyeContact, cinematicRealism.
  const isSocialPortrait = isEditorial &&
    /social.portrait|ИДЕАЛЬНЫЙ КАДР|clean.authentic.portrait|personal.brand.*portrait|LinkedIn.*portrait|social.media.*portrait/i.test(input.stylePrompt);

  const socialPortraitBlock = `\
CLEAN AUTHENTIC PORTRAIT:
Natural soft light — window light, overcast daylight, or soft studio glow.
No dramatic shadows, no cinematic mood lighting, no fashion campaign atmosphere.
Clean neutral or softly blurred background. No expensive interiors, no luxury environments.
Realistic proportions — preserve the subject's real body, no elongation, no slimming.
Styling: business casual or smart casual — wearable, real, not curated by a stylist.
Natural makeup, natural hair — neat and polished but not editorial.
Expression: warm, approachable, confident, authentic. Not model-blank, not performative.
Result: the best real version of this person — as they would appear in a premium real-life photo,
not in a luxury magazine campaign.
FORBIDDEN: Vogue aesthetic, fashion editorial energy, luxury campaign styling,
dramatic lighting, evening glamour, yacht or luxury interior backgrounds,
AI doll look, exaggerated beauty, over-retouching, fantasy costume, cosplay.`;

  // LITTLE CEO GIRL — детский luxury cinematic portrait. Активен только если isEditorial = false.
  const isLittleCeoGirl = !isEditorial &&
    /little.ceo|LITTLE CEO|МАЛЕНЬКАЯ ЛЕДИ|little.*boss.*girl|ceo.*girl|child.*executive/i.test(input.stylePrompt);

  const littleCeoGirlBlock = `\
LITTLE CEO GIRL:
Luxury cinematic portrait of a confident young girl in an elegant tailored business suit.
Modern executive office with panoramic skyline windows, premium architecture,
warm natural daylight, expensive cinematic atmosphere.

The child should look intelligent, charismatic, calm and naturally confident.
She is not posing like an adult fashion model.
She looks like a future leader with authentic child energy.

Quiet luxury aesthetic:
tailored blazer, white shirt, premium fabrics, minimal elegant styling,
clean executive fashion, natural hairstyle, soft expensive textures.

Scenes may include:
executive office, modern desk, city skyline, luxury library,
conference room, architectural interior, business lounge, creative workspace.

Emotion:
confidence, curiosity, intelligence, warmth, focus, dream-big energy.

Visual direction:
cinematic realism, Netflix-level photography, editorial luxury portrait,
soft sunlight, beautiful reflections, depth, natural skin texture, alive expressive eyes.

No exaggerated glamour. No heavy makeup. No sexualized styling.
No plastic AI beauty. No adult businesswoman posing. No fashion runway energy.
The child must remain natural, realistic, emotionally alive and age-appropriate.`;

  // [CHILD EMOTION & CINEMATIC LIFE] — живые эмоции, cinematic energy, Disney/Netflix-уровень.
  // Заменяет старый family-lifestyle блок. Активен только если isEditorial = false.
  const childLifestyleBlock = `\
CHILD EMOTION & CINEMATIC LIFE:
Children must look alive, emotional, natural and cinematic.
Real happiness, curiosity, confidence, wonder, playful energy, warm genuine smiles.
No empty AI stare, no frozen mannequin expression, no adult-like posing.

Every scene should feel like a real movie moment:
running, laughing, exploring, dreaming, performing, discovering, interacting with the world.

Bright elegant wardrobe with premium cinematic styling:
soft luxury fabrics, cozy textures, refined children fashion, natural colors, light tones, rich visual depth.

Locations must feel magical, immersive and varied:
snow landscapes, modern cities, libraries, elegant offices, nature, studios,
luxury interiors, cinematic fantasy realism.

Avoid repetition:
different camera angles, different lighting, different emotions,
different environments, different poses, different compositions in every generation.

Soft cinematic lighting, emotional storytelling, realistic skin texture,
natural child proportions, premium Disney/Netflix-level visual atmosphere.

NO: empty expression, cheap costume look, plastic skin, adult glamour makeup,
AI doll face, repetitive poses, dark horror fantasy, cheap cartoon aesthetic.`;

  // [AVOID] — встроенный negative prompt. Gemini/OpenRouter не принимает
  // отдельное поле negative_prompt, поэтому список запретов идёт в текст.
  // Lifestyle/kids добавляет свои специфичные термины поверх базового списка.
  const lifestyleAvoidExtra = ', adult fashion pose, luxury glamour child model, stiff school portrait, mannequin child pose, horror atmosphere, creepy fantasy, plastic AI children, cheap carnival costume, dark scary atmosphere, repetitive compositions, empty expression, dead eyes';
  const fullBodyAvoidExtra = input.isFullBody
    ? ', tiny head, elongated limbs, unrealistic skinny body, body slimming, body enlargement, fake curves, fitness model body replacement, doll anatomy, body distortion, body type change, wrong body proportions'
    : '';
  const avoidBlock = `AVOID: ${buildNegativePrompt()}${isEditorial ? '' : lifestyleAvoidExtra}${fullBodyAvoidExtra}`;

  return [
    // ── Глобальные блоки ──────────────────────────────────────────────────────
    referenceBlock,
    '',
    identityBlock,
    '',
    ...(input.isFullBody ? [fullBodyFaceLockBlock, ''] : []),
    realismBlock,
    '',
    // ── Editorial-only блоки (isEditorial = false → не включаются) ────────────
    ...(isEditorial
      ? [
          // isSocialPortrait отключает тяжёлые luxury блоки — они противоречат clean portrait
          ...(!isSocialPortrait ? [auraBlock, ''] : []),
          ...(!isSocialPortrait ? [luxuryAdaptBlock, ''] : []),
          editorialBlock, '',
          ...(!isSocialPortrait ? [fashionBlock, ''] : []),
          candorBlock, '',
          ...(!isSocialPortrait ? [magnetismBlock, ''] : []),
          ...(!isSocialPortrait ? [femininityBlock, ''] : []),
          eyeContactBlock, '',
          cinematicRealismBlock, '',
          ...(!isSocialPortrait ? [antiCheapBlock, ''] : []),
          antiRepetitionBlock, '',
          ...(isFutureLuxury ? [futureLuxuryBlock, ''] : []),
          ...(isWildLuxury ? [wildLuxuryBlock, ''] : []),
          ...(isOldMoneyEstate ? [oldMoneyEstateBlock, ''] : []),
          ...(isGoddess ? [goddessBlock, ''] : []),
          ...(isEliteSport ? [eliteSportBlock, ''] : []),
          ...(isSocialPortrait ? [socialPortraitBlock, ''] : []),
        ]
      : [childLifestyleBlock, '', ...(isLittleCeoGirl ? [littleCeoGirlBlock, ''] : [])]),
    // ── Состав и технические параметры ───────────────────────────────────────
    fullBodyHint,
    // OUTFIT INSPIRATION не нужен для social portrait — там нет fashion-stylist направления
    ...(isEditorial && !isSocialPortrait ? [`OUTFIT INSPIRATION: ${pickGarment()} — adapt colorway and silhouette to harmonize with the subject's natural coloring and the style direction.`] : []),
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    input.customPrompt ? `Additional note: ${input.customPrompt}` : '',
    '',
    // ── Глобальный AVOID ──────────────────────────────────────────────────────
    avoidBlock,
  ].filter(Boolean).join('\n');
}

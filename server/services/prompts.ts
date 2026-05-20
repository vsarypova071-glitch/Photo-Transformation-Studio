// Wardrobe + buildPrompt — взяты из supabase/functions/generate-one/index.ts
// чтобы у Beget single-generation был такой же визуальный стиль, как сейчас.

const WARDROBE_FEMALE: readonly string[] = [
  'flowing silk midi dress in warm terracotta with gentle drape',
  'structured blazer dress in cobalt blue, sharp feminine silhouette',
  'elegant wrap dress in deep emerald green, soft luxurious fabric',
  'sculptural midi dress in rich burgundy wine, premium fabric',
  'minimalist slip dress in warm champagne with delicate lace detail',
  'tailored shirt dress in powder blue, clean modern cut',
  'dramatic floor-length gown in midnight navy with sculptural silhouette',
  'soft cashmere knit dress in warm camel, effortless luxury',
  'bespoke power suit in deep forest green premium cashmere',
  'precision blazer in warm coral with tailored wide-leg trousers',
  'oversized cashmere coat in off-white over silk blouse in dusty rose',
  'silk blouse in warm peach with high-waist camel trousers',
  'blazer in lavender blue with matching wide-leg trousers',
  'luxury cocktail dress in deep plum with elegant draping',
];

const WARDROBE_MALE: readonly string[] = [
  'bespoke tailored suit in deep navy with subtle texture',
  'precision charcoal suit with crisp white dress shirt, no tie',
  'luxury cashmere blazer in camel over white shirt and dark trousers',
  'structured double-breasted suit in midnight blue, premium fabric',
  'smart casual: tailored jacket in forest green, slim trousers',
  'luxury turtleneck in cream cashmere under structured blazer',
  'crisp white dress shirt with tailored dark trousers, luxury watch',
  'classic black suit with fine white shirt, timeless elegance',
  'premium overcoat in warm camel over dark slim-fit trousers',
  'relaxed luxury: linen blazer in sand with premium white shirt',
  'tailored suit in warm burgundy, modern masculine silhouette',
  'structured blazer in deep emerald, dark premium trousers',
];

function pickGarment(genderMode?: 'female' | 'male'): string {
  const wardrobe = genderMode === 'male' ? WARDROBE_MALE : WARDROBE_FEMALE;
  return wardrobe[Math.floor(Math.random() * wardrobe.length)];
}

// Позы для портретного кадра (голова + плечи / поясной).
const POSES_PORTRAIT: readonly string[] = [
  'three-quarter turn, weight shifted to one hip, relaxed shoulder drop — candid editorial',
  'leaning lightly against surface, arms naturally relaxed, genuine unstaged energy',
  'slight head tilt, direct confident gaze, subtle natural asymmetry in posture',
  'caught mid-moment — body relaxed, natural breath, not posed for camera',
  'shoulders at slight angle to camera, grounded confident stance, direct eye contact',
  'natural hand near face or collar — organic gesture, not staged or forced',
  'body lightly turned, strong editorial angle — like a working photographer caught the moment',
  'glancing back toward camera — candid luxury editorial moment, genuine personality',
];

// Позы для full-body кадра.
const POSES_FULLBODY: readonly string[] = [
  'walking naturally toward camera — caught mid-step, body in real motion',
  'leaning against wall or surface, weight on one leg, arms naturally at sides',
  'standing at slight angle, body language open and grounded, direct gaze',
  'pausing mid-movement, looking into camera — candid luxury lifestyle moment',
  'elegant natural stride — confident forward motion, not a runway walk',
  'one hand in pocket, weight shifted, relaxed powerful presence in open space',
  'three-quarter turn, weight on back leg, looking over shoulder toward camera',
];

// Схемы освещения — каждая создаёт отдельный атмосферный мир.
const LIGHTINGS: readonly string[] = [
  'golden hour sidelight from left — warm directional sun, long soft shadows, rich amber glow on skin',
  'overcast diffused daylight — soft even natural light, no harsh shadows, clean editorial clarity',
  'soft window light from right — gentle key light, natural shadow falloff on opposite side, indoor warmth',
  'blue hour ambient exterior — cool soft dusk light, cinematic atmosphere, moody natural tones',
  'morning golden frontlight — gentle warm illumination, delicate skin glow, fresh alive energy',
  'dramatic soft sidelight — strong directional light sculpting the face, deep cinematic shadow',
  'open midday shade — bright reflected outdoor light, even clean illumination, summer freshness',
];

function pickPose(isFullBody?: boolean): string {
  const library = isFullBody ? POSES_FULLBODY : POSES_PORTRAIT;
  return library[Math.floor(Math.random() * library.length)];
}

function pickLighting(): string {
  return LIGHTINGS[Math.floor(Math.random() * LIGHTINGS.length)];
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
  genderMode?: 'female' | 'male';
  // Необязательный override категории. Если не передан — auto-detect по stylePrompt.
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
    // Eye contact & eyewear
    'sunglasses', 'wearing sunglasses', 'tinted glasses', 'eyewear covering eyes',
    'looking away from camera', 'side glance', 'averted gaze',
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
  const isMale = input.genderMode === 'male';

  // ── GENDER MODIFIER BLOCKS ──────────────────────────────────────────────────

  const genderPositiveBlock = isMale
    ? `\
MASCULINE STYLING (required):
This is a male portrait. The subject is a man. Generate exclusively masculine presentation.
Styling: elegant menswear — tailored suit, structured blazer, luxury shirt, premium jacket, smart coat.
Grooming: clean masculine grooming — neat hair, clean shave or light stubble. No makeup, no feminine styling.
Pose: confident, grounded, masculine energy. Direct eye contact with camera.
FORBIDDEN: any dress, skirt, blouse, feminine jewelry, feminine makeup, lipstick, exposed shoulders,
feminine silhouette, female body proportions, evening gown, feminine accessories.`
    : `\
FEMININE STYLING (required):
This is a female portrait. The subject is a woman. Generate exclusively feminine presentation.
Styling: elegant feminine outfit — beautiful dress, luxury blouse, tailored feminine suit,
soft fabrics, refined silhouette. Refined makeup applied naturally. Elegant jewelry if appropriate.
Pose: graceful, feminine, confident. Direct eye contact with camera.
FORBIDDEN: masculine suit cut, menswear styling, beard, mustache, overly broad masculine shoulders,
male body proportions, generic gender-neutral presentation.`;

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
- EYE CONTACT: subject looks directly into the camera with natural confident gaze. No looking away, no side glance.
- NO SUNGLASSES OR EYEWEAR — eyes and gaze must be fully visible at all times.
- Skin: keep natural micro-texture, subtle visible pores, soft realistic shadows. No airbrushing or smoothing.
- Expression: natural, human, emotionally present. Warm confident energy — not blank stare, not artificial smile.
- Lighting: soft cinematic natural light with believable environmental shadows and realistic lens depth.
- Final result must look like a real candid editorial photograph — not CGI, not a render, not a wax figure.`;

  // [REAL PHOTOGRAPHY FEEL] — глобальная директива: ощущение настоящей дорогой фотосессии.
  // Применяется ко всем стилям без исключения.
  const realPhotographyBlock = `\
REAL PHOTOGRAPHY FEEL (mandatory global directive):
This image must feel like it was captured by a real professional photographer on a real photoshoot — not generated by AI.
The viewer must sense: a real human being was photographed in a real moment.

WHAT MUST BE PRESENT:
- Captured candid moment: the subject feels caught mid-breath, mid-thought — alive and present.
- Natural body tension: authentic weight distribution, relaxed muscles, subtle human asymmetry.
- Breathing realism: the body feels like it exhales — no frozen stiffness, no mannequin rigidity.
- Authentic posture: natural spine alignment, organic weight shift, a real person standing in a real space.
- Natural skin response to lighting: realistic subsurface glow, gentle micro-shadows, visible skin texture — not airbrushed plastic.
- Emotional realism: inner life radiates from the expression — a real emotional state, not a posed performance.
- Imperfect human beauty: natural asymmetry, subtle life in the features — not hyper-corrected CGI.
- Cinematic human depth: the subject has interiority, personality, presence beyond the frame.
- Luxury magazine photography: Vogue / Harper's Bazaar / Condé Nast real photoshoot aesthetic.

THE VIEWER MUST FEEL: "This was shot by an expensive real photographer — not generated by AI."

FORBIDDEN:
- Mannequin stiffness, doll-like frozen posture, AI doll energy.
- Hyper-symmetrical hyper-smooth artificial perfection — looks generated, not photographed.
- Fashion render energy: 3D CGI model aesthetic instead of a real human being.
- Plastic skin without texture, airbrushed face without natural detail.
- Empty eyes with no soul, no depth, no inner world.`;

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
FASHION & INDIVIDUAL STYLE:
- The outfit color must be chosen to flatter THIS specific person's natural skin tone, hair color, and overall coloring.
  Warm skin tones → terracotta, camel, warm coral, gold, olive green, burgundy.
  Cool skin tones → cobalt blue, lavender, emerald, dusty rose, icy white, deep navy.
  Neutral/medium tones → any rich saturated color — forest green, warm amber, dusty mauve, teal.
- COLOR DIVERSITY: every image should feel like a different, considered color story. Avoid repeating the same palette.
- The outfit must express who SHE IS — her personality, her individuality, her character — not generic editorial fashion.
- Clothing silhouette must flatter her natural body type: tailored where structure helps, flowing where softness suits.
- NO SUNGLASSES. Eyes must always be visible and expressive.
- Footwear must match the premium editorial styling: elegant refined shoes appropriate to the setting.
- Full outfit should feel curated by a personal stylist — cohesive, intentional, beautifully chosen.
- Premium but believable: real clothes, real person, real moment.`;

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

  // ЛЕТНИЙ ГОРОД (quiet_luxury) — bright daylight summer urban. Строго до isFutureLuxury,
  // чтобы не пересекаться с neon/cyber блоком.
  const isSummerCity = isEditorial &&
    /SUMMER ENERGY|ЛЕТНИЙ ГОРОД/i.test(input.stylePrompt);

  const summerCityBlock = `\
SUMMER CITY (mandatory output requirements):
BRIGHT DAYLIGHT ONLY — warm orange-golden afternoon sunlight flooding the scene. No dark, moody or neon lighting.
Setting: sun-drenched rooftop terrace with panoramic city views, vivid southern European street cafe, or bright beach promenade — open sky, warm air, summer energy.
Color palette: warm orange, turquoise, coral, bright white, summer blue sky. Saturated, joyful, vibrant.
Fashion: lightweight summer dress, casual chic in bright warm tones — orange, white, turquoise, coral.
FORBIDDEN: neon lights, dark backgrounds, cyberpunk / sci-fi aesthetics, moody / low-key lighting, night scenes, dark color palette.`;

  // FUTURE LUXURY — активируется для НЕОНОВЫЙ ГОРОД и других sci-fi / future стилей.
  const isFutureLuxury = isEditorial && !isSummerCity &&
    /CYBER LUXURY|НЕОНОВЫЙ ГОРОД|future|futurist|sci-fi|scifi|cyberpunk|architectural.*tech/i.test(input.stylePrompt);

  const futureLuxuryBlock = `\
FUTURE LUXURY:
Future aesthetics must feel elegant, architectural, wealthy, cinematic, emotionally sophisticated.
Preferred inspiration: Dubai elite, chrome minimalism, luxury skyscrapers, sculptural fashion, future haute couture.
Avoid: cyberpunk clichés, latex fetish aesthetics, gamer visuals, sci-fi cosplay, neon overload.`;

  // ТИХАЯ РОСКОШЬ / OLD MONEY LIFESTYLE — quiet luxury, old money estate. Активен для editorial стилей.
  const isOldMoneyEstate = isEditorial &&
    /ТИХАЯ РОСКОШЬ|тихая.*роскошь|quiet.*luxury.*lifestyle|old.*money.*lifestyle/i.test(input.stylePrompt);

  // WILD LUXURY — активируется только для стилей с явными животными (волк, пантера и т.д.).
  // Намеренно НЕ срабатывает на ДИКАЯ ПРИРОДА / FRESH WILDERNESS (там нет животных).
  const isWildLuxury = isEditorial && !isOldMoneyEstate &&
    /WILD LUXURY|panther|wolf|lion|royal.*bear/i.test(input.stylePrompt);

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
    /DIVINE CINEMATIC|БОГИНЯ|богин|goddess|GODDESS|intellectual.*elegance/i.test(input.stylePrompt);

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

  // ELITE SPORT — активируется для СПОРТ и luxury fitness стилей.
  const isEliteSport = isEditorial &&
    /PREMIUM ATHLETIC|elite.sport|ЭЛИТНЫЙ СПОРТ|СПОРТ|luxury.*fitness|luxury.*gym|luxury.*sport|fitness.*luxury|sport.*luxury|athletic.*luxury|luxury.*wellness|luxury.*tennis|luxury.*pilates/i.test(input.stylePrompt);

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

  // SOCIAL PORTRAIT / ОБРАЗ ДЛЯ СОЦСЕТЕЙ — чистый authentic portrait для соцсетей и личного бренда.
  // Отключает тяжёлые luxury-editorial блоки (aura, fashion, magnetism, femininity, antiCheap).
  // Сохраняет: identity, realism, editorialBlock (композиция), candorBlock, eyeContact, cinematicRealism.
  const isSocialPortrait = isEditorial &&
    /PREMIUM INFLUENCER PORTRAIT|ОБРАЗ ДЛЯ СОЦСЕТЕЙ|social.portrait|ИДЕАЛЬНЫЙ КАДР|clean.authentic.portrait|personal.brand.*portrait/i.test(input.stylePrompt);

  // ЧЁРНО-БЕЛЫЙ ПОРТРЕТ — timeless monochrome studio portrait.
  // Как social portrait: отключает тяжёлые luxury-блоки.
  // Дополнительно: вставляет блок принудительного B&W вывода.
  const isBWPortrait = isEditorial &&
    /TIMELESS PORTRAIT|ЧЁРНО-БЕЛЫЙ|bw.portrait|monochrome.*portrait|grayscale.*portrait/i.test(input.stylePrompt);

  // Общий флаг: оба portrait-режима отключают одни и те же luxury-блоки.
  const isCleanPortrait = isSocialPortrait || isBWPortrait;

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

  const bwPortraitBlock = `\
BLACK & WHITE PORTRAIT (critical output requirement):
RENDER THE ENTIRE IMAGE IN PURE BLACK AND WHITE — full grayscale, zero color, no tint.
This is a premium monochrome studio portrait: Vogue / Harper's Bazaar editorial level.
Rich tonal range — luminous skin tones in grayscale, clean beautiful contrast without harsh shadows.
Studio portrait lighting: soft directional key light, gentle fill, minimal shadow play.
Background: simple, clean, minimal — plain studio or soft gradient grey.
Fashion: simple elegant dark jacket or structured blouse, minimal jewelry — no patterns, no bright colors.
Expression: strong, characterful, intelligent, composed. Timeless editorial presence.
FORBIDDEN: any color tint (warm or cool), sepia effect, horror aesthetic, noir darkness,
heavy film grain, harsh dramatic shadows, cheap black-and-white filter effect.`;

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
  const genderAvoidExtra = isMale
    ? ', dress, skirt, blouse, feminine makeup, lipstick, long eyelashes, female body, feminine jewelry, exposed shoulders, evening gown, feminine silhouette, woman\'s clothing'
    : ', masculine suit cut, menswear, beard, mustache, overly broad masculine shoulders, male body proportions, male clothing';
  const avoidBlock = `AVOID: ${buildNegativePrompt()}${isEditorial ? '' : lifestyleAvoidExtra}${fullBodyAvoidExtra}${genderAvoidExtra}`;

  return [
    // ── Глобальные блоки ──────────────────────────────────────────────────────
    referenceBlock,
    '',
    identityBlock,
    '',
    genderPositiveBlock,
    '',
    ...(input.isFullBody ? [fullBodyFaceLockBlock, ''] : []),
    realismBlock,
    '',
    realPhotographyBlock,
    '',
    // ── Editorial-only блоки (isEditorial = false → не включаются) ────────────
    ...(isEditorial
      ? [
          // isSocialPortrait отключает тяжёлые luxury блоки — они противоречат clean portrait
          ...(!isCleanPortrait ? [auraBlock, ''] : []),
          ...(!isCleanPortrait ? [luxuryAdaptBlock, ''] : []),
          editorialBlock, '',
          ...(!isCleanPortrait ? [fashionBlock, ''] : []),
          candorBlock, '',
          ...(!isCleanPortrait ? [magnetismBlock, ''] : []),
          ...(!isCleanPortrait && !isMale ? [femininityBlock, ''] : []),
          eyeContactBlock, '',
          cinematicRealismBlock, '',
          ...(!isCleanPortrait ? [antiCheapBlock, ''] : []),
          antiRepetitionBlock, '',
          ...(isSummerCity ? [summerCityBlock, ''] : []),
          ...(isFutureLuxury ? [futureLuxuryBlock, ''] : []),
          ...(isWildLuxury ? [wildLuxuryBlock, ''] : []),
          ...(isOldMoneyEstate ? [oldMoneyEstateBlock, ''] : []),
          ...(isGoddess ? [goddessBlock, ''] : []),
          ...(isEliteSport ? [eliteSportBlock, ''] : []),
          ...(isSocialPortrait ? [socialPortraitBlock, ''] : []),
          ...(isBWPortrait ? [bwPortraitBlock, ''] : []),
        ]
      : [childLifestyleBlock, '', ...(isLittleCeoGirl ? [littleCeoGirlBlock, ''] : [])]),
    // ── Состав и технические параметры ───────────────────────────────────────
    fullBodyHint,
    // OUTFIT INSPIRATION не нужен для social portrait — там нет fashion-stylist направления
    ...(isEditorial && !isCleanPortrait ? [`OUTFIT INSPIRATION: ${pickGarment(input.genderMode)} — choose a colorway that specifically flatters THIS person's natural skin tone and hair. The outfit must feel personally chosen for them, not generic. It should express their individuality and enhance their natural appearance. Subject looks directly at camera, no sunglasses.`] : []),
    // POSE: случайная поза из библиотеки. Не для clean portrait — там своя жёсткая композиция.
    ...(isEditorial && !isCleanPortrait ? [`POSE: ${pickPose(input.isFullBody)} — feel candid, alive, editorial. Not stiff, not staged, not runway.`] : []),
    // LIGHTING: случайная схема. Не для BW portrait — там строгий studio lighting в своём блоке.
    ...(isEditorial && !isBWPortrait ? [`LIGHTING: ${pickLighting()}`] : []),
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    input.customPrompt ? `Additional note: ${input.customPrompt}` : '',
    '',
    // ── Глобальный AVOID ──────────────────────────────────────────────────────
    avoidBlock,
  ].filter(Boolean).join('\n');
}

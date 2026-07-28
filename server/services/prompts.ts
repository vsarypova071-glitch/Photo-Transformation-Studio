// Wardrobe + buildPrompt — взяты из supabase/functions/generate-one/index.ts
// чтобы у Beget single-generation был такой же визуальный стиль, как сейчас.

import { filterWish, detectEnvironment, EnvironmentHint } from './wishFilter';

const WARDROBE_FEMALE: readonly string[] = [
  'flowing silk midi dress in warm terracotta with gentle drape',
  'structured blazer dress in cobalt blue, sharp feminine silhouette',
  'elegant wrap dress in deep emerald green, soft luxurious fabric',
  'sculptural midi dress in rich burgundy wine, premium fabric',
  'elegant satin midi dress in warm champagne with refined modest neckline',
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

// ── SOCIAL PORTRAIT VARIETY POOLS ────────────────────────────────────────────
// Used exclusively by social_portrait style. Picked once per buildPrompt() call →
// each generation gets a different outfit + pose + background combination.
// 24 female outfits × 10 poses × 12 backgrounds = 2880 unique starting combinations.

const WARDROBE_SOCIAL_FEMALE: readonly string[] = [
  'structured oversized camel blazer with slim high-waist white tailored trousers and minimal gold pendant',
  'flowing silk blouse in warm dusty rose with wide-leg cream trousers, delicate gold necklace',
  'double-breasted blazer dress in cobalt blue — sharp feminine silhouette, polished modern cut',
  'soft cashmere turtleneck in warm ivory layered under open structured blazer in warm stone',
  'sculpted satin midi dress in deep burgundy wine — refined drape, visible luxurious fabric weight',
  'double-breasted blazer in rich forest green over crisp white fitted blouse, slim dark trousers',
  'structured blazer in warm coral over ivory silk blouse with tailored wide-leg cream trousers',
  'luxurious ribbed knit midi dress in warm camel — premium fabric, clean minimal styling',
  'classic tailored trench coat in warm beige worn open over fitted black turtleneck and slim trousers',
  'high-waist midi skirt in terracotta with tucked silk blouse in warm cream — editorial everyday elegance',
  'blazer in soft lavender over crisp white blouse, tailored wide-leg trousers — modern feminine power',
  'structured leather blazer in cognac over clean white tee, straight-leg premium dark trousers',
  'fine-knit draped cardigan in warm oat over elegant satin midi dress in champagne — layered effortless luxury',
  'fitted wrap dress in deep emerald green — elegant V-silhouette, premium crepe fabric',
  'sharp tailored suit in deep navy — fitted blazer over crisp white blouse, authoritative modern femininity',
  'structured wool jacket in rich chocolate brown with slim trousers, refined warm visible texture',
  'tonal cream monochrome look — cream structured blazer over cream blouse, slim cream trousers, quiet luxury minimalism',
  'luxury fine-gauge ribbed turtleneck in deep olive green with premium tailored trousers, sophisticated knitwear',
  'minimalist black designer outfit — clean architectural cut, premium matte fabric, sculptural modern silhouette',
  // Мягкие премиум-ткани (quiet luxury) — добавлены к структурным образам для разнообразия фактур
  'luxurious chunky cable-knit cashmere sweater in warm cream with elegant high turtleneck, rich soft visible texture',
  'fluid pure silk blouse in warm ivory, softly draped at the collar — effortless high-end elegance, light-catching fabric',
  'flowing satin top in deep rich burgundy, minimalist refined drape that catches light beautifully',
  'tailored velvet blazer in deep emerald over a fine silk camisole — sophisticated soft luxury texture',
  'soft finely-woven cashmere wrap cardigan in warm beige over a delicate champagne silk top — layered quiet luxury',
];

const WARDROBE_SOCIAL_MALE: readonly string[] = [
  'tailored navy blazer over crisp white shirt, no tie — smart premium modern look',
  'luxury linen shirt in warm white, slim premium dark trousers, clean casual-elegant',
  'structured double-breasted blazer in charcoal, fitted white shirt, understated authority',
  'soft cashmere turtleneck in warm camel under open structured blazer in warm sand',
  'bespoke suit in deep forest green with white shirt — distinctive modern masculine',
  'premium overshirt in warm cognac over slim dark trousers, refined casual luxury',
  'crisp Oxford shirt in pale sky blue with tailored slim trousers, luxury watch detail',
  'fine-knit crewneck in warm grey over white shirt, clean straight-leg trousers',
];

// v12 (living beauty workflow): раньше каждая запись жёстко диктовала "face
// frontal to camera" — это был единственный источник поворота головы, и именно
// поэтому social_portrait был исключён из общего COMPOSITION-механизма (см.
// ниже). Теперь голова/взгляд управляются ИСКЛЮЧИТЕЛЬНО через новый пул
// COMPOSITIONS_SOCIAL_PORTRAIT (безопасная вариативность из ТЗ владелицы) —
// формулировка "face frontal" убрана отсюда, чтобы не спорить с ним (тот же
// принцип разделения ACTION/COMPOSITION, что и для остального каталога, см.
// комментарий у ACTIONS_PORTRAIT). Тело/жест/эмоция — здесь, голова/взгляд — там.
const POSES_SOCIAL_PORTRAIT: readonly string[] = [
  'soulful intense eye contact with real emotional depth, lips softly relaxed, arms loosely at sides — alive and present',
  'one hand lightly touching collar, deep alive gaze, natural unforced expression — magnetic quiet presence',
  'seated naturally, hands resting in lap, intimate present gaze toward the lens',
  'leaning back gently against a clean surface, relaxed shoulders, warm soulful eyes, effortless calm',
  'one hand casually in pocket, natural weight shift, confident alive gaze with genuine personality',
  'both hands lightly clasped at waist, elegant posture, deep magnetic eye contact — composed inner power',
  'soft natural smile allowed, eyes alive and expressive — caught in a real genuine moment',
  'arms loosely crossed at waist, relaxed and confident, direct soulful eye contact, real human warmth',
  'weight on one leg, hip shifted naturally, deep present gaze with quiet emotional intensity',
  'relaxed open posture, calm alive energy, intimate gaze toward the lens — vulnerability and quiet strength',
];

const BACKGROUNDS_SOCIAL: readonly string[] = [
  'seamless warm grey gradient studio backdrop — professional clean minimal photography, NO furniture, NO decor',
  'seamless soft ivory studio backdrop — clean professional portrait photography, NO objects, NO domestic elements',
  'smooth warm beige studio wall — clean even surface, no texture pattern, no furniture, no decorative objects',
  'clean neutral grey architectural wall surface — solid, uniform, soft focus, NO furniture, NO vases, NO plants',
  'soft warm white studio seamless background — professional photography setup, uniform tone, nothing visible behind',
  'blurred minimal outdoor setting — clean blurred greenery or building exterior, NO domestic interior, NO furniture',
  'clean warm taupe studio surface — solid neutral colour, soft vignette, professional portrait photography quality',
  'soft natural light against plain warm plaster wall — single colour surface only, NO furniture, NO decor objects',
  'dark charcoal textured studio backdrop — professional portrait photography, rich neutral tone, NO objects',
  'clean light blue-grey studio seamless — cool professional studio photography, neutral and minimal',
  'hand-painted grey canvas studio backdrop — painterly muted texture with soft dark brushstroke gradients, classic fine-art portrait studio, NO objects',
  'hand-painted warm taupe-brown canvas backdrop — subtle mottled painterly texture, timeless master-photographer studio aesthetic, NO objects',
];

// ── ENVIRONMENT-AWARE WARDROBE POOLS ─────────────────────────────────────────
// Activated when detectEnvironment() finds a scene cue in the user's filtered wish.
// Each pool is scene-coherent: no blazers on beaches, no bikinis in offices.
// Falls back to WARDROBE_FEMALE / WARDROBE_MALE when no environment is detected.

const ENV_WARDROBE_FEMALE: Record<EnvironmentHint, readonly string[]> = {
  beach_resort: [
    'flowing linen midi dress in warm white with gentle breeze drape — Mediterranean beach resort elegance',
    'light linen sundress in sandy beige with subtle texture — effortless coastal summer luxury',
    'elegant flowing resort dress in soft ivory with wide brim hat — luxury beach lifestyle, fully covered',
    'relaxed linen co-ord set in warm sand tone — resort wear, elegant coastal leisure',
    'lightweight cotton maxi dress in sky blue with thin straps — pure seaside summer editorial',
  ],
  yacht_nautical: [
    'crisp white linen blouse with tailored navy wide-leg trousers, leather sandals — Monaco yacht club',
    'flowing white silk maxi dress with navy accent — Riviera luxury, Mediterranean afternoon',
    'premium navy and ivory striped linen set — classic nautical luxury, Côte d\'Azur aesthetic',
    'lightweight silk blouse in ivory over cream tailored shorts — riviera resort summer fashion',
    'tailored wide-leg trousers in warm white with nautical navy top — refined Monaco marina afternoon',
    'lightweight cream silk midi skirt with relaxed navy linen blouse — Côte d\'Azur harbour editorial',
  ],
  alpine_winter: [
    'oversized cashmere coat in cream over luxury turtleneck, slim premium trousers — alpine elegance',
    'premium ski parka in deep navy with tailored slim snow trousers — luxury alpine resort style',
    'chunky cable-knit turtleneck in warm oat over tailored wool trousers — Courchevel après-ski chic',
    'luxurious sherpa-trim parka in camel, warm boots — mountain luxury editorial fashion',
    'fine cashmere jumper in ivory fitted at the waist, sleek dark ski trousers — alpine luxury portrait',
  ],
  evening_dinner: [
    'sculptural floor-length gown in deep midnight with elegant draping — luxury dinner editorial',
    'sleek fitted midi dress in deep wine with gathered detail — sophisticated evening wear',
    'elegant satin evening dress in champagne gold with refined jewelry and modest neckline — dinner party look',
    'elegant evening gown in deep forest green, minimal luxury styling — timeless dinner glamour',
    'draped satin dress in dusty rose, one-shoulder silhouette — premium evening editorial',
  ],
  business_formal: [
    'precision-tailored blazer in deep charcoal with slim trousers, crisp white blouse — executive authority',
    'structured double-breasted blazer dress in midnight navy — powerful corporate femininity',
    'fitted pencil skirt and matching blazer in warm taupe — refined professional presence',
    'tailored blazer in rich cobalt over cream high-neck blouse, slim trousers — modern executive woman',
    'sleek high-neck blouse in ivory with sharp-cut charcoal wide-leg trousers — senior executive presence',
    'structured collarless blazer in warm camel over slim cream trousers — modern quiet luxury corporate',
  ],
  nature_outdoor: [
    'relaxed premium linen trousers in warm earth tone and soft cotton blouse — nature editorial luxury',
    'tailored utility jacket in olive over wide-leg premium trousers — editorial outdoor elegance',
    'soft cashmere sweater in warm camel and relaxed luxury trousers — countryside editorial mood',
    'flowing maxi skirt in terracotta and tucked silk top — nature lifestyle luxury editorial',
    'oversized linen shirt in warm sand over slim trousers — effortless editorial nature aesthetic',
  ],
  city_casual: [
    'tailored oversized blazer in warm camel over fitted turtleneck, slim trousers — urban editorial chic',
    'silk blouse in dusty rose with high-waisted tailored trousers — city lifestyle premium fashion',
    'structured midi dress in warm cognac — urban premium editorial, city luxury lifestyle',
    'minimalist knit dress in deep charcoal with elegant accessories — clean modern urban look',
    'relaxed wool coat in warm stone over fitted turtleneck, slim dark trousers — elevated urban lifestyle',
    'tailored leather blazer in warm cognac over clean white tee, straight-leg trousers — city premium editorial',
  ],
};

const ENV_WARDROBE_MALE: Record<EnvironmentHint, readonly string[]> = {
  beach_resort: [
    'premium linen shirt in soft white, open collar, tailored shorts — luxury beach resort aesthetic',
    'relaxed linen co-ord in sandy beige — Mediterranean resort wear, effortless coastal elegance',
    'lightweight linen shirt in light blue over tailored swim shorts — refined seaside lifestyle',
    'premium white resort shirt half-tucked, linen shorts — natural luxury beach moment',
    'vintage-washed cotton button-down in sky blue, relaxed tailored shorts — effortless coastal luxury',
  ],
  yacht_nautical: [
    'crisp white linen shirt, open collar, navy tailored shorts, premium watch — Monaco yacht club',
    'luxury navy polo shirt with tailored cream chinos — Riviera nautical summer elegance',
    'premium white quarter-zip over dark tailored shorts — yacht lifestyle, luxury summer',
    'classic navy linen blazer over crisp white shirt, tailored chinos — Riviera yacht club elegance',
    'premium ivory linen co-ord — relaxed elegant yacht owner, sun-drenched Mediterranean afternoon',
  ],
  alpine_winter: [
    'premium ski parka in deep charcoal, fitted base layer, luxury snow trousers — alpine editorial',
    'chunky cable-knit sweater in cream under structured outdoor jacket — mountain luxury lifestyle',
    'luxury performance jacket in navy over slim merino turtleneck — alpine resort masculine elegance',
    'luxury down vest in deep navy over premium merino turtleneck, fitted ski trousers — alpine weekend',
    'warm slate grey ski jacket with tailored snow trousers, luxury watch detail — mountain editorial',
  ],
  evening_dinner: [
    'perfectly tailored black tuxedo, crisp white shirt, slim bow tie — elegant dinner sophistication',
    'navy slim-fit dinner suit, fine white dress shirt — refined evening masculine presence',
    'dark charcoal suit with premium white shirt, pocket square — timeless evening luxury',
    'slim double-breasted suit in deep forest green, white shirt, no tie — elevated modern dinner luxury',
    'premium cream dinner jacket with tailored dark trousers — summer evening, Riviera gala aesthetic',
  ],
  business_formal: [
    'bespoke tailored suit in deep navy, crisp white shirt, no tie — senior executive authority',
    'precision charcoal suit with structured white dress shirt — masculine professional presence',
    'tailored double-breasted suit in midnight blue — commanding business masculine elegance',
    'slim-cut suit in warm olive, white shirt — modern executive with quiet distinguished personality',
    'luxury herringbone blazer in rich brown over cream shirt, dark trousers — intellectual authority',
  ],
  nature_outdoor: [
    'premium linen shirt in warm sand over tailored outdoor trousers — editorial nature lifestyle',
    'relaxed luxury field jacket in olive over premium white shirt, slim trousers — outdoor editorial',
    'soft cashmere sweater in warm camel, relaxed luxury trousers — countryside masculine elegance',
    'premium technical fleece in warm charcoal over slim outdoor trousers — editorial mountain lifestyle',
    'slim-cut waxed jacket in olive over premium cotton shirt — English countryside gentleman energy',
  ],
  city_casual: [
    'tailored jacket in forest green, slim trousers, premium white shirt — smart urban masculine',
    'luxury turtleneck in cream cashmere under structured open blazer — city editorial cool',
    'premium overshirt in warm cognac over slim dark trousers — relaxed urban luxury masculine',
    'structured wool coat in camel over clean white shirt, slim dark trousers — elevated city daily look',
    'navy unstructured blazer over premium grey tee and slim chinos — effortless urban masculine style',
  ],
};

/**
 * Picks a wardrobe item appropriate for the scene environment detected from the
 * user's filtered wish. Falls back to the default random pool if no environment
 * cue is present — preserving existing behaviour for all non-location wishes.
 *
 * Only fires for editorial non-clean-portrait styles (same condition as the
 * OUTFIT INSPIRATION line in the return array). MEN cinematic styles are
 * handled separately by pickMenWardrobe() and are never affected.
 */
function pickEnvironmentAwareGarment(filteredWish: string, genderMode?: 'female' | 'male'): string {
  const env = detectEnvironment(filteredWish);
  if (!env) return pickGarment(genderMode);
  const pool = genderMode === 'male' ? ENV_WARDROBE_MALE[env] : ENV_WARDROBE_FEMALE[env];
  return pickFromArray(pool);
}

// ── LUXURY COLOR PALETTE POOLS ───────────────────────────────────────────────
// Rotated randomly per generation to drive visual diversity across repeated
// generations of the same style. AI is instructed to cross-reference the
// suggested palette with THIS specific person's natural coloring from the
// reference photo — palette is a starting direction, not a hard override.

const COLOR_PALETTES: Record<string, readonly string[]> = {
  cool_elegant:     ['cobalt blue', 'steel grey', 'dusty rose', 'icy white', 'deep navy', 'silver', 'soft lavender', 'muted slate'],
  warm_elegant:     ['camel', 'terracotta', 'warm coral', 'cognac', 'cream', 'champagne', 'warm amber', 'soft gold'],
  deep_contrast:    ['midnight black', 'deep charcoal', 'forest green', 'dark plum', 'deep wine', 'rich espresso', 'dark navy'],
  soft_neutral:     ['ivory', 'warm oat', 'sand beige', 'dusty mauve', 'soft blush', 'pale grey', 'warm white'],
  luxury_universal: ['deep emerald', 'rich burgundy', 'warm cognac', 'teal', 'deep plum', 'forest green', 'cobalt blue'],
};

/** Returns a random "palette label — color list" string for the COLOR ADAPTATION block. */
function pickColorDirection(): string {
  const keys = Object.keys(COLOR_PALETTES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return `${key.replace(/_/g, ' ')} — ${COLOR_PALETTES[key].join(', ')}`;
}

/**
 * Builds the PERSONAL COLOR ADAPTATION prompt block.
 *
 * Rotates through 5 luxury palette pools per generation to prevent color repetition
 * across successive generations of the same style.
 *
 * Detects whether the user mentioned a specific clothing item in their wish —
 * if so, keeps the silhouette but adapts color to the person's natural coloring.
 *
 * No AI color analysis — prompt-level instruction only. The AI reads the
 * reference photo and applies the direction accordingly.
 */
function buildColorInstruction(filteredWish: string): string {
  const colorDirection = pickColorDirection();

  // Detect user-specified clothing item (RU + EN).
  const userMentionedClothing = /платье|костюм|пиджак|блуза|рубашка|юбка|брюки|куртка|пальто|dress|suit|blazer|blouse|shirt|skirt|trousers|jacket|coat/i.test(filteredWish);

  const base = `PERSONAL COLOR ADAPTATION:
Analyze THIS specific person's natural coloring from the reference photo — skin undertone, hair color, eye color.
Choose outfit colors that genuinely flatter their specific coloring, not a generic editorial palette choice.
Color direction for this generation: ${colorDirection}.
The outfit must feel personally selected for this individual — not randomly assigned.
Hair undertone guidance: warm golden → camel, ivory, champagne, cognac, warm amber.
Cool/fair → steel grey, navy, icy white, dusty rose, cobalt. Deep warm → chocolate, forest green, burgundy.
Dark hair → midnight, rich black, ivory, silver, deep emerald. Neutral → any rich saturated color.`;

  const clothingAdaptLine = userMentionedClothing
    ? '\nUser mentioned a specific clothing type — honor the silhouette, but choose the exact color/shade to flatter this person\'s natural coloring from the reference photo.'
    : '';

  return base + clothingAdaptLine;
}

// Позы для портретного кадра (голова + плечи / поясной).
// P2: расширен с 8 до 12 — снижает вероятность повтора позы при генерации разных стилей.
const POSES_PORTRAIT: readonly string[] = [
  'three-quarter turn, weight shifted to one hip, relaxed shoulder drop — candid editorial',
  'leaning lightly against surface, arms naturally relaxed, genuine unstaged energy',
  'slight head tilt, direct confident gaze, subtle natural asymmetry in posture',
  'caught mid-moment — body relaxed, natural breath, not posed for camera',
  'shoulders at slight angle to camera, grounded confident stance, direct eye contact',
  'natural hand near face or collar — organic gesture, not staged or forced',
  'body lightly turned, strong editorial angle — like a working photographer caught the moment',
  'glancing back toward camera — candid luxury editorial moment, genuine personality',
  // +4 новых
  'standing near architecture, one arm loosely raised, fingertips grazing surface — dynamic but effortless',
  'seated or perched, legs together, hands softly in lap, looking directly into camera — composed modern poise',
  'half-turned, one shoulder forward, gaze over shoulder toward lens — caught in a real transition moment',
  'chin resting lightly on hand, thoughtful direct gaze — quiet confident intelligence, wholly natural gesture',
];

// Позы для full-body кадра.
// P2: расширен с 7 до 10.
const POSES_FULLBODY: readonly string[] = [
  'walking naturally toward camera — caught mid-step, body in real motion',
  'leaning against wall or surface, weight on one leg, arms naturally at sides',
  'standing at slight angle, body language open and grounded, direct gaze',
  'pausing mid-movement, looking into camera — candid luxury lifestyle moment',
  'elegant natural stride — confident forward motion, not a runway walk',
  'one hand in pocket, weight shifted, relaxed powerful presence in open space',
  'three-quarter turn, weight on back leg, looking over shoulder toward camera',
  // +3 новых
  'standing in architectural frame (doorway, archway, window) — environment as natural border, body at ease',
  'crouching slightly or sitting on low surface, elbows on knees, direct calm gaze — grounded editorial energy',
  'side profile, weight on far leg, chin slightly lifted, looking forward — strong clean silhouette shot',
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

// Освещение для social_portrait — мягкий студийный свет, как в профессиональной
// портретной съёмке: ровное, flattering, без драматики. Ни golden hour, ни blue hour.
const LIGHTINGS_SOCIAL: readonly string[] = [
  'large soft-box frontal beauty light — even clean illumination across the entire face, minimal shadow, warm-neutral colour temperature, professional studio portrait quality, clean bright catchlights in both eyes',
  'large front-left softbox with gentle fill from right — smooth even skin light, barely-there shadow under chin, bright clean eyes, premium beauty photography quality',
  'soft diffused window light from front-left — even skin illumination, natural warm daylight quality, flattering catchlights, no hard shadows anywhere on the face',
  'beauty-dish key light at slight angle with large reflector fill — classic flattering portrait studio lighting, warm neutral tone, clean skin, bright expressive eyes',
  'overcast daylight quality — bright even diffused natural light, no directional shadow, skin glows naturally, flat clean flattering beauty-portrait light',
  'large overhead softbox with front reflector — bright even studio illumination, skin texture visible and natural, clean warm neutral, professional headshot lighting quality',
  // Кинематографичный мягкий свет — объём без жёсткой драмы, fine-art портрет
  'cinematic diffused soft daylight — gentle natural falloff giving subtle three-dimensional depth on the face, timeless fine-art portrait atmosphere, no harsh shadow',
  'soft warm daylight from a large side window — gentle glowing rim light on the hair, real depth and catchlights in the eyes, intimate editorial mood',
  'soft warm morning light through a sheer curtain — diffused, intimate and emotional fine-art atmosphere, flattering even glow on the skin',
];

function pickPose(isFullBody?: boolean): string {
  const library = isFullBody ? POSES_FULLBODY : POSES_PORTRAIT;
  return library[Math.floor(Math.random() * library.length)];
}

function pickLighting(): string {
  return LIGHTINGS[Math.floor(Math.random() * LIGHTINGS.length)];
}

// ── ЖЕНСКИЕ STYLE-SPECIFIC POSE POOLS ────────────────────────────────────────
// P2: стиль-специфичные позы для 4 женских образов с уникальной physicality.
// Паттерн как в MEN серии — pickFemaleEditorialPose() детектирует стиль по тегу
// в stylePrompt и выбирает из нужного pool. Остальные стили → POSES_PORTRAIT/FULLBODY.

// БОГИНЯ (intellectual_elegance) — эпическая, морская, ветер, скалы.
const POSES_FEMALE_GODDESS: readonly string[] = [
  'standing at cliff edge, wind in hair and fabric, arms slightly open — silent power, sea behind',
  'sitting on marble terrace ledge overlooking sea, one hand resting on stone, direct composed gaze',
  'turned in profile against open ocean horizon, fabric catching wind, strong and still as the landscape',
  'walking slowly on coastal stone path, looking back over shoulder at camera with quiet authority',
  'both hands resting lightly on ancient stone wall, looking into camera — calm ownership of the space',
  'one arm raised slightly against sea wind, weight back on one hip, dress in motion — epic editorial',
];

// МОНАКО (new_york_power) — яхта, набережная, расслабленный luxury статус.
const POSES_FEMALE_MONACO: readonly string[] = [
  'standing on yacht bow, one hand on chrome railing, sea wind in hair — relaxed confident nautical',
  'leaning against harbour railing with Mediterranean sea behind, arms loose, direct calm gaze',
  'sitting on promenade wall, one leg drawn up, looking toward sea — effortless Monaco afternoon',
  'walking along dock looking sideways at the water — caught mid-stroll, candid lifestyle energy',
  'hand resting on luxury car rooftop at waterfront, weight on one hip, subtle natural confidence',
  'forearms resting on yacht railing, Mediterranean light on face, open warm direct gaze to camera',
];

// РОМАНТИКА (parisian_chic) — мягкая, кафе, цветы, свет Парижа / летний сад.
const POSES_FEMALE_ROMANCE: readonly string[] = [
  'sitting at outdoor cafe table, elbows resting, both hands around coffee cup, warm natural smile',
  'standing beside sunny cafe window, one hand lightly touching glass, looking out into warm street',
  'walking through flower market, looking over shoulder at camera — soft spontaneous candid moment',
  'seated on sunlit park bench with book open, looking up at camera with gentle genuine expression',
  'standing in warm doorway, shoulder against the frame, flowers nearby — relaxed feminine presence',
  'holding small flower bouquet at chest level, looking directly into camera with soft quiet joy',
];

// ДИКАЯ ПРИРОДА (golden_hour_glow) — натуральная, свободная, горы / лес / открытые пространства.
const POSES_FEMALE_WILD: readonly string[] = [
  'standing on rocky outcrop with open valley behind, weight on one leg, grounded confident gaze',
  'arms lightly open to sides, chin slightly lifted — breathing in open wilderness, alive and free',
  'sitting on boulder or fallen log, hands on knees, looking directly at camera — still, real, grounded',
  'walking through tall grass, hands brushing the tips, looking over shoulder at camera — candid nature',
  'leaning back against ancient tree trunk, hands in coat pockets, steady forest gaze — rooted energy',
  'crouching near stream or water edge, one arm resting on knee, candid natural editorial moment',
];

/** Выбирает позу для женских editorial стилей с style-specific пулами.
 *  При совпадении с одним из 4 стилей — берёт из профильного пула.
 *  Иначе — из общего POSES_PORTRAIT / POSES_FULLBODY (как раньше).
 *  Сигнатура идентична pickPose() для простой замены в buildPrompt(). */
function pickFemaleEditorialPose(stylePrompt: string, isFullBody?: boolean): string {
  // Детектируем по тегам из SQL-промптов (migration 009).
  if (/DIVINE CINEMATIC|БОГИНЯ/i.test(stylePrompt))     return pickFromArray(POSES_FEMALE_GODDESS);
  if (/MONACO LIFESTYLE|МОНАКО/i.test(stylePrompt))     return pickFromArray(POSES_FEMALE_MONACO);
  if (/SUMMER HAPPINESS|РОМАНТИКА/i.test(stylePrompt))  return pickFromArray(POSES_FEMALE_ROMANCE);
  if (/FRESH WILDERNESS|ДИКАЯ ПРИРОДА/i.test(stylePrompt)) return pickFromArray(POSES_FEMALE_WILD);
  // Fallback: стандартный пул (portrait или full-body).
  return isFullBody
    ? pickFromArray(POSES_FULLBODY)
    : pickFromArray(POSES_PORTRAIT);
}

// ── MEN CINEMATIC SERIES: банки поз, атмосфера, одежда ─────────────────────
// Используются только для стилей с тегом [MEN:] в stylePrompt.

const POSES_MEN_DESERT: readonly string[] = [
  'standing confidently next to the open SUV door, one hand resting on the door frame, direct camera gaze',
  'leaning casually against the SUV hood, arms lightly crossed, relaxed masculine presence',
  'one hand in pocket, three-quarter turn toward camera, weight shifted — grounded confident stance',
  'stepping out of the SUV caught mid-movement — natural energy, real candid adventure moment',
  'sitting on the open door edge, one foot on the sand, relaxed editorial adventure pose',
  'adjusting luxury wristwatch beside the SUV, glancing up toward camera — caught in a real moment',
  'crossed arms near the front hood, weight shifted back, rugged masculine confidence',
];

const POSES_MEN_FISHING: readonly string[] = [
  'holding giant Northern Pike proudly with both hands at chest level, broad smile, direct eye contact',
  'holding trophy fish and making a casual relaxed thumbs-up — genuine masculine pride and joy',
  'standing on dock with fish held outward toward camera — trophy presentation, natural proud posture',
  'kneeling at lake shore with trophy fish — grounded, authentic, editorial outdoor moment',
  'fish held to the side, body in three-quarter turn — proud energy with misty lake behind',
];

const POSES_MEN_YACHT: readonly string[] = [
  'one hand in shorts pocket, direct eye contact, relaxed confident stance on yacht deck',
  'leaning lightly against the yacht rail, open ocean horizon behind, natural casual weight shift',
  'adjusting luxury watch, looking up toward camera — caught in a real relaxed authentic moment',
  'standing confidently on deck, body slightly turned, open grounded masculine posture',
  'walking slowly across deck, caught mid-step — natural cinematic movement energy',
  'one-hand-in-pocket stance, wide ocean horizon in background, calm dominant masculine presence',
];

const POSES_MEN_LION: readonly string[] = [
  'standing confidently beside lion, one hand in trouser pocket, calm dominant stance, direct camera gaze',
  'crossed arms beside the lion, strong composed posture, alpha leader energy radiating outward',
  'adjusting suit jacket cuff near the lion — subtle authoritative gesture, composed executive presence',
  'slight three-quarter turn toward camera — caught in a powerful composed moment beside the lion',
  'standing at angle to camera, lion at side — commanding cinematic leadership composition',
  'looking toward savanna horizon, lion beside him — wide epic leadership framing',
];

// ── MEN CINEMATIC SERIES WAVE 2: variation banks ────────────────────────────

const POSES_MEN_INTELLECTUAL: readonly string[] = [
  'sitting in a leather armchair of a premium library, arms relaxed on armrests, direct intelligent calm gaze into camera — quiet authority',
  'standing beside floor-to-ceiling bookshelves, one hand resting lightly on books, composed thoughtful direct gaze — intellectual presence',
  'leaning forward slightly at a clean modern desk, hands clasped, intense focused gaze directly at camera — analytical energy',
  'holding a book or notebook in one hand, looking up directly into camera with sharp composed gaze — intellectual confidence',
  'three-quarter turn near a tall window with natural light, relaxed posture, calm intelligent direct gaze into camera — editorial presence',
];

const WARDROBE_MEN_INTELLECTUAL: readonly string[] = [
  'tailored charcoal blazer over a premium white Oxford shirt — understated intellectual authority, clean minimal styling',
  'smart dark merino turtleneck sweater, clean premium minimal look — modern intellectual elegance without effort',
  'refined business casual: premium navy blazer, white shirt, no tie — intellectual confidence without formality',
  // P2: +3 варианта → pool 6, сокращает повторы при 5+ генерациях
  'fitted charcoal turtleneck under an open structured blazer in warm tobacco brown — quiet academic authority',
  'premium dark navy overshirt with subtle texture, worn open over clean white tee — smart relaxed intellectual energy',
  'light grey fine-wool crewneck sweater with pressed dark trousers — Princeton-library casual, effortless intelligence',
];

const POSES_MEN_PRIVATE_JET: readonly string[] = [
  'sitting relaxed in plush leather seat, holding crystal whiskey glass, direct calm gaze into camera — billionaire composure',
  'looking through oval airplane window, profile caught mid-thought, light flooding across face — cinematic wealth',
  'adjusting luxury wristwatch with both hands, glancing up toward camera — caught in a real wealthy moment',
  'leaning back fully in first-class leather seat, arm resting on tray, one leg crossed — effortless confidence',
  'standing in jet aisle slightly, hand resting on seat back, direct camera gaze — private jet owner energy',
];

const WARDROBE_MEN_PRIVATE_JET: readonly string[] = [
  'premium white quarter-zip cashmere knit sweater, luxury watch visible — first-class effortless wealth',
  'unbuttoned luxury black silk shirt, relaxed open collar, premium watch — cinematic billionaire casual',
  'beige fine cashmere crewneck sweater, minimal elegant styling — quiet old-money luxury aesthetic',
  // P2: +3 варианта → pool 6
  'stone-grey premium cashmere zip-up hoodie, relaxed and expensive — billionaire off-duty, above the clouds',
  'midnight navy fine-knit polo, understated luxury watch, single thin bracelet — refined first-class elegance',
  'cream merino wool rollneck under open linen blazer in warm sand — European luxury travel, effortless premium',
];

const POSES_MEN_ATHLETE: readonly string[] = [
  'standing confidently in a premium gym, arms loose at sides, direct powerful focused gaze into camera — athletic authority',
  'leaning one hand against a wall or column, relaxed athletic weight shift, direct composed gaze — grounded presence',
  'seated on a weight bench, forearms resting on knees, direct intense focused gaze into camera — authentic training moment',
  'standing outdoors in athletic gear, three-quarter turn, alive masculine energy looking directly into camera',
  'mid-motion pause — caught between reps, powerful authentic athletic energy, direct confident gaze into camera',
];

const WARDROBE_MEN_ATHLETE: readonly string[] = [
  'premium black performance t-shirt and athletic shorts, luxury brand aesthetic — clean powerful athletic presence',
  'fitted compression base layer top with premium running shorts, elite athletic training aesthetic',
  'luxury performance hoodie open over a fitted athletic tank — sporty editorial masculine lifestyle look',
  // P2: +3 варианта → pool 6
  'clean white premium athletic tee and dark training shorts — minimal elite fitness, editorial calm energy',
  'structured athletic jacket in slate grey, open over performance base layer — luxury sport editorial cool',
  'premium navy technical quarter-zip pullover, fitted athletic trousers — high-performance lifestyle aesthetic',
];

const POSES_MEN_WARRIOR: readonly string[] = [
  'standing powerfully facing camera, one gauntleted hand on sword hilt, direct intense warrior gaze — unyielding presence',
  'arms crossed against mountain wind, cloak billowing, composed unbreakable stance, direct camera gaze',
  'looking toward distant mountain horizon, side-profile cinematic composition — contemplative warrior leader',
  'low-angle shot from below, warrior towering against stormy sky, dramatic heroic framing, direct eyes at camera',
  'stepping forward through snow, armor catching cold light, breath misting in frozen air — alive cinematic warrior moment',
];

const WARDROBE_MEN_WARRIOR: readonly string[] = [
  'dark forged metal plate armor with massive heavy fur cape, intricate battle-worn detailing — legendary warrior',
  'weathered dark leather warrior vest with iron chest plates, aged leather bracers — Nordic warrior aesthetic',
  'cinematic full dark armored outfit with wolf-fur mantle, clasp detail, worn battle aesthetic — legendary hero',
];

function pickFromArray<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMenPose(stylePrompt: string): string {
  if (/DESERT KING/i.test(stylePrompt))    return pickFromArray(POSES_MEN_DESERT);
  if (/BIG CATCH/i.test(stylePrompt))      return pickFromArray(POSES_MEN_FISHING);
  if (/KING OF THE OCEAN/i.test(stylePrompt)) return pickFromArray(POSES_MEN_YACHT);
  if (/MASTER OF LIFE/i.test(stylePrompt)) return pickFromArray(POSES_MEN_LION);
  if (/INTELLECTUAL/i.test(stylePrompt))    return pickFromArray(POSES_MEN_INTELLECTUAL);
  if (/PRIVATE JET/i.test(stylePrompt))    return pickFromArray(POSES_MEN_PRIVATE_JET);
  if (/\bATHLETE\b/i.test(stylePrompt))    return pickFromArray(POSES_MEN_ATHLETE);
  if (/LEGEND WARRIOR/i.test(stylePrompt)) return pickFromArray(POSES_MEN_WARRIOR);
  return pickPose();
}

function buildMenAtmosphere(stylePrompt: string): string {
  if (/DESERT KING/i.test(stylePrompt))
    return 'ATMOSPHERE: Sandy desert canyon at golden sunset. Dust particles floating in warm canyon air. Sun rays piercing through dust clouds. Heat haze visible in the distance. Wind moving jacket fabric slightly. Volumetric warm golden light casting long shadows.';
  if (/BIG CATCH/i.test(stylePrompt))
    return 'ATMOSPHERE: Misty lake at sunrise. Soft golden hour sun flare reflecting on still water. Morning atmospheric fog drifting across the lake surface. Calm peaceful lake setting. Weathered wooden dock beneath feet. Warm cinematic sunrise color grade.';
  if (/KING OF THE OCEAN/i.test(stylePrompt))
    return 'ATMOSPHERE: Golden tropical sunset reflecting across the ocean. Sun flare breaking through evening clouds. Ocean wind moving jacket fabric. Cinematic warm tropical mist in the air. Luxury yacht lifestyle premium visual.';
  if (/MASTER OF LIFE/i.test(stylePrompt))
    return 'ATMOSPHERE: Warm African golden hour sunset. Cinematic sun flare on the horizon. Soft dust particles in the evening air. Dramatic long shadows stretching across the vast savanna below. Wind subtly moving suit fabric. Rocky cliff edge with panoramic savanna vista.';
  if (/INTELLECTUAL/i.test(stylePrompt))
    return 'ATMOSPHERE: Premium private library or modern minimal workspace with warm amber light. Floor-to-ceiling bookshelves, rich leather furniture, warm wooden surfaces. Soft natural light through tall windows. Intellectual atmosphere of quiet authority and composed achievement.';
  if (/PRIVATE JET/i.test(stylePrompt))
    return 'ATMOSPHERE: Exclusive private jet interior. Warm golden sunlight streaming through oval cabin windows. Plush cream leather seats, polished wood trim, premium aviation luxury details. Quiet powerful cabin — above the clouds, above the world.';
  if (/\bATHLETE\b/i.test(stylePrompt))
    return 'ATMOSPHERE: Modern luxury gym with floor-to-ceiling windows and panoramic city views, or premium outdoor athletic training setting at golden hour. Clean architectural lines, premium equipment, warm cinematic light. Athletic masculine energy radiating from the space.';
  if (/LEGEND WARRIOR/i.test(stylePrompt))
    return 'ATMOSPHERE: Dramatic snowy mountain peaks under dark stormy sky. Cinematic movie-grade lighting cutting through clouds. Heavy fog rolling through mountain valleys. Snow and ice catching cold directional light. Epic fantasy-realism visual — dark, powerful, legendary.';
  return `LIGHTING: ${pickLighting()}`;
}

function pickMenWardrobe(stylePrompt: string): string {
  if (/DESERT KING/i.test(stylePrompt))
    // P2 fix: разведён с King of Ocean (оба были open jacket + torso).
    // Desert King = сухопутный экспедитор, King of Ocean = яхтенный атлет.
    return 'rugged khaki tactical shirt with sleeves rolled to elbow, worn leather belt, dark expedition cargo shorts — sand-dusted adventure explorer, no exposed torso';
  if (/BIG CATCH/i.test(stylePrompt))
    return 'functional olive green tactical outdoor suit, luxury watch — rugged refined expedition aesthetics';
  if (/KING OF THE OCEAN/i.test(stylePrompt))
    return 'open premium black jacket over toned athletic torso, dark shorts, luxury watch — ocean lifestyle aesthetic';
  if (/MASTER OF LIFE/i.test(stylePrompt))
    return 'charcoal tailored business suit, crisp white shirt, premium fabric — authoritative alpha executive';
  if (/INTELLECTUAL/i.test(stylePrompt))    return pickFromArray(WARDROBE_MEN_INTELLECTUAL);
  if (/PRIVATE JET/i.test(stylePrompt))    return pickFromArray(WARDROBE_MEN_PRIVATE_JET);
  if (/\bATHLETE\b/i.test(stylePrompt))    return pickFromArray(WARDROBE_MEN_ATHLETE);
  if (/LEGEND WARRIOR/i.test(stylePrompt)) return pickFromArray(WARDROBE_MEN_WARRIOR);
  return pickGarment('male');
}

// Ключевые слова lifestyle/kids стилей. Совпадение → editorial-блоки отключаются.
// Список намеренно консервативный: неизвестные стили получают editorial по умолчанию.
const LIFESTYLE_KEYWORDS: readonly string[] = [
  'kids', 'children', 'child', 'toddler', 'baby', 'newborn',
  'family', 'cozy', 'casual everyday', 'home',
  'дет', 'ребен', 'малыш', 'семей', 'домашн',
];

// v12 (living beauty workflow bugfix): social_portrait's реальный DB-текст (migration
// 020, "[PREMIUM INFLUENCER PORTRAIT]") содержит фразу "home workspace" — LIFESTYLE_KEYWORDS
// ловит в ней подстроку 'home' и без этой страховки detectIsEditorial() молча возвращал
// false для social_portrait, роня его в childLifestyleBlock-ветку вместо editorial/
// socialPortraitBlock. Обнаружено при тестировании этой правки реальным stylePrompt, а
// не тестовой заглушкой — прежде тестов на social_portrait не было вообще. Тот же принцип
// "styleId как страховка от текста промпта", что и у isBWPortrait ниже (migration 020).
//
// v13 (full-catalog audit fix): та же болезнь нашлась у scandinavian_minimal —
// реальный DB-текст ("cozy premium textiles", "Warm cozy expensive winter lifestyle")
// дважды ловит 'cozy' из LIFESTYLE_KEYWORDS, и стиль молча падал в childLifestyleBlock —
// детский блок и детский AVOID внутри взрослого альпийского люкс-стиля. Добавлен сюда
// по тому же принципу; при появлении новых подобных инцидентов — тот же паттерн.
const EDITORIAL_STYLE_ID_OVERRIDE: ReadonlySet<string> = new Set(['social_portrait', 'scandinavian_minimal']);

// Определяет, нужны ли fashion/editorial блоки для данного стиля.
// Приоритет: явный styleCategory > styleId-страховка > keyword detection по stylePrompt > default editorial.
function detectIsEditorial(
  stylePrompt: string,
  styleCategory?: 'editorial' | 'lifestyle',
  styleId?: string,
): boolean {
  if (styleCategory === 'editorial') return true;
  if (styleCategory === 'lifestyle') return false;
  if (styleId && EDITORIAL_STYLE_ID_OVERRIDE.has(styleId)) return true;
  // Fallback: ищем lifestyle-маркеры в тексте промпта (без учёта регистра).
  const lower = stylePrompt.toLowerCase();
  return !LIFESTYLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface BuildPromptInput {
  /** ID стиля из БД/bundle — используется как дополнительный сигнал детектирования
   *  когда prompt может быть пустым (bundle fallback). Например: 'bw_portrait'. */
  styleId?: string;
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
//
// v11 (live photoshoot redesign): убраны синонимичные кластеры (было по 4-9 почти
// одинаковых терминов на одну идею — "tired/fatigued/grey/dull/washed-out/unwell/
// aging/wrinkles/exhausted/older/worn/fatigue shadows" сжаты в 3), убран блок
// 'looking away from camera'/'side glance'/'averted gaze' — он противоречил новой
// вариативности COMPOSITION (профиль/три четверти теперь разрешены намеренно).
// Добавлено: text/logo/watermark (были явно нужны по ТЗ и отсутствовали), extra
// or fused fingers/deformed hands (анатомия рук — раньше только в позитиве не было
// нигде), identical repeated pose across a series (анти-повтор на уровне негатива).
//
// v12 (flattering beauty retouch): 'over-smoothed airbrushed skin' и 'flawless
// artificial face' сохранены как есть (нужны, чтобы не потерять объём кожи и не
// получить искусственное лицо). 'beauty filter' → 'cheap obvious social-media
// beauty-filter look' — профессиональная ретушь разрешена, дешёвый фильтр нет.
// 'added wrinkles'/'older worn appearance' → 'radically different apparent age' +
// 'unnaturally childlike or excessively rejuvenated face' — старый парой запрещал
// только "старше", но не ограничивал степень омоложения, а новая цель — именно
// деликатное омоложение, не смена возрастной категории. 'changed hairstyle'
// убран из Hair-кластера — конфликтовал с разрешённой укладкой/объёмом; стрижка
// и цвет по-прежнему запрещены. Добавлен кластер против задвоенного лица.
export function buildNegativePrompt(): string {
  return [
    // Identity & face integrity
    'plastic skin', 'wax face', 'mannequin doll face', 'blank dead-eyed stare',
    'CGI', '3D render', 'over-smoothed airbrushed skin', 'flawless artificial face',
    'cheap obvious social-media beauty-filter look', 'altered identity', 'changed face structure',
    'uncanny valley', 'different person', 'generic AI face', 'wrong eye spacing', 'distorted face',
    'fashion model face', 'runway model transformation', 'beauty-face geometry',
    'altered facial proportions', 'stylized facial anatomy',
    // Duplicated face / feature doubling
    'duplicated face', 'double face artifact', 'overlapping facial features', 'second face in frame',
    // Lower-face drift — either direction is wrong
    'slimmed V-shape jaw', 'sharp pointed chin', 'hollow sculpted cheeks',
    'widened rounded face', 'puffy cheeks', 'moon face', 'reshaped face oval',
    // Composition & pose
    'passport photo look', 'stiff pose', 'artificial smile', 'centered static pose',
    'HR portrait framing', 'passport composition', 'flat even studio lighting',
    'stiff mannequin posture', 'static fashion pose', 'identical repeated pose across a series',
    // Glamour / cheap luxury
    'influencer glamour aesthetic', 'duck lips', 'exaggerated seduction', 'artificial sexiness',
    'escort aesthetic', 'vulgar glamour', 'nightclub energy', 'flashy rich aesthetic',
    'gold overload', 'casino luxury', 'hypersexual styling',
    // Non-premium backgrounds
    'cafe interior', 'coffee shop', 'domestic interior', 'budget location', 'cheap office',
    'random home interior',
    // Anti-fatigue / anti-age-extremes
    'tired fatigued face', 'grey dull washed-out skin',
    'radically different apparent age', 'unnaturally childlike or excessively rejuvenated face',
    // Hair
    'different haircut or length', 'changed hair color',
    // Eyes & eyewear
    'sunglasses', 'eyewear covering the eyes', 'vacant unfocused gaze',
    // Makeup render artifacts
    'lipstick stains on teeth', 'smeared bleeding makeup',
    // Anatomy
    'extra or fused fingers', 'deformed hands', 'floating or extra limbs',
    // Text & branding
    'text overlay', 'typography', 'captions or subtitles', 'logos', 'watermark', 'signature',
    // Photo quality
    'digital noise', 'oversharpened edges', 'oversaturated colors', 'smartphone photo quality',
  ].join(', ');
}

// ── IDENTITY LOCK (v11 live-photoshoot redesign) ─────────────────────────────
// Единственный источник правды по identity/anatomy/age/weight/hair. Раньше эта
// же мысль повторялась 4 раза разными словами: инлайновый "ABSOLUTE PRIORITY"
// заголовок в buildPrompt(), identityBlock (FACE GEOMETRY LOCK), BODY_SHAPE_LOCK
// (вес/возраст), fullBodyFaceLockBlock (та же face geometry ещё раз для
// full-body). Все 4 объединены в один блок — воспроизводится один раз,
// освобождает ~6000 символов на добавление живых блоков ниже.
// Порядок приоритета внутри блока соответствует ТЗ: identity → анатомия →
// возраст/вес/кожа → волосы → что разрешено менять.
//
// v12 (flattering beauty retouch): AGE, BODY & SKIN раньше буквально запрещал
// "no rejuvenation" и acceptance test явно исключал "a nicer version of them" —
// это прямо противоречило новой цели (красивый, свежий, деликатно моложе,
// профессиональная beauty-ретушь). Заменено на явный, но ограниченный допуск:
// свежесть/лёгкое омоложение разрешены, но только внутри той же широкой
// возрастной категории — не "другое поколение". Кость/геометрия лица (см. блок
// FACE GEOMETRY выше) не меняются, это ограничение осталось нетронутым. HAIR
// аналогично: раньше "no restyling" блокировало даже укладку/объём — теперь
// укладка разрешена, но стрижка/длина/цвет лица — нет.
const IDENTITY_LOCK = `\
IDENTITY LOCK — HIGHEST PRIORITY, OVERRIDES EVERYTHING BELOW:
Priority order for this entire generation: 1) identity  2) anatomical correctness  3) natural
emotion  4) action  5) environment interaction  6) composition  7) clothing and style.
Whenever any instruction below conflicts with identity preservation, identity wins. A less
flattering but recognizable result is always better than a beautiful but different-looking person.

Goal: this must read as "the same person, photographed on a different day" — not "someone who
resembles them."

FACE GEOMETRY (copy exactly from the reference photo, at whatever angle the composition below
calls for): inter-eye distance, eye shape and size, iris color and pattern, eye placement, brow
shape and position, nose shape/width/bridge/tip, lip shape and width, cheekbone position and
volume, jawline shape, chin shape, and the overall face oval. None of these are adjusted, slimmed,
widened, sharpened, or softened toward a more "attractive" or "generic model" version — copy them,
don't reinterpret them. This holds true at ANY head angle — head angle itself is set by the
composition instruction later in this prompt, not restricted here.

AGE, BODY & SKIN: preserve the subject's recognizable identity, bone structure, facial geometry,
ethnicity, and exact body weight and proportions (waist, hips, chest, arms, legs — do not slim or
enlarge). Remain within the same broad recognizable age category. The person may look fresher and
subtly younger, but never like a different generation or a radically different age. Within that
range, the following are welcome: clean, even, radiant skin; a refreshed, well-rested under-eye
area; gently softened age markers; professional, natural-looking beauty retouching; and an overall
fresher, more attractive appearance. Real skin texture is not erased — it is refreshed, not
plasticized.

HAIR: same length, cut, and color as the reference — no change of haircut, length, or color. Hair
styling — volume, waves, smoothness, a neat professional finish — may be refined for a polished
look, as long as the underlying cut, length, and color stay identical to the reference.

WHAT MAY CHANGE (this is the entire scope of styling — nothing else touches the identity
safeguards above): clothing, accessories, hair styling (not cut/length/color), background/location,
lighting, skin freshness and beauty retouching within the limits above, and the emotional
expression and action described later in this prompt.

Acceptance test: this is unmistakably the same person at their most attractive — fresh, rested,
polished and subtly younger, photographed on their best day by an expensive portrait photographer
after professional makeup, hair styling, flattering light, and refined beauty retouching. It must
never read as "a different person."`;

// ── CHILD IDENTITY LOCK (v13, full-catalog audit fix) ────────────────────────
// Раньше детские (lifestyle) стили получали ТОТ ЖЕ универсальный IDENTITY_LOCK,
// что и взрослые editorial-стили — включая "subtly younger", "professional,
// natural-looking beauty retouching" и acceptance test про "expensive portrait
// photographer... after professional makeup". Для фото ребёнка это концептуально
// неуместная рамка (омоложение/взросление, профессиональный макияж, взрослая
// beauty-подача), даже без прямой опасности. Отдельный блок: тот же приоритет
// identity/анатомия, но без взрослой beauty-ретуши/омоложения, с явным запретом
// макияжа и adult grooming (бритьё и т.п.), и с возрастно-уместной, а не
// "лучшей взрослой версией себя" рамкой результата.
const CHILD_IDENTITY_LOCK = `\
IDENTITY LOCK — HIGHEST PRIORITY, OVERRIDES EVERYTHING BELOW:
This is a photograph of a real child. Priority order: 1) identity  2) anatomical correctness
3) natural age-appropriate emotion  4) safe, age-appropriate styling and scene.
Whenever any instruction below conflicts with identity preservation, identity wins. A less
polished but recognizable result is always better than a stylized but different-looking child.

Goal: this must read as "the same child, photographed on a different day" — never an adult,
never a different-looking child, never a stylized "model" child.

FACE GEOMETRY (copy exactly from the reference photo): eye shape, size and color, eye placement,
nose shape, lip shape, cheek and face oval, ethnicity, and natural asymmetry. None of these are
adjusted, slimmed, sharpened, or idealized toward a "cuter" or generic version — copy them, don't
reinterpret them.

AGE: preserve the child's exact real age and age category. No de-aging, no aging up, no making a
younger child look older or an older child look younger or more infantile. This must remain the
same real child at the same real age.

SKIN & EYES: healthy, clean, naturally glowing child skin, real texture — no adult beauty
retouching, no plastic or artificial smoothing, no makeup of any kind. Eyes alive, bright, with a
genuine, natural childhood expression and real catchlights.

HAIR: same length and color as the reference. Only neat, age-appropriate tidying is allowed — no
adult restyling, no adult hair-coloring technique, no change of length or color.

WHAT MAY CHANGE: clothing, accessories, background/location, lighting, and the natural
age-appropriate emotion and action described later in this prompt — nothing else touches the
identity safeguards above.

FORBIDDEN: rejuvenation or aging language, adult makeup, adult beauty-retouching framing, facial
hair, shaving or adult grooming instructions, sexualized or glamour styling, adult luxury "best
version of themselves" framing. This is a child's photo, not a beauty campaign.

Acceptance test: this is unmistakably the same real child, the same real age, healthy and happy —
never an adult, never a different-looking child.`;

// Заменяет genderPositiveBlock/menGenderBlock для lifestyle-ветки (дети) — те
// блоки говорят "This is a female/male portrait. The subject is a woman/man" и
// разрешают макияж/бритьё, что неуместно для ребёнка. Нейтральное 'child',
// если genderMode не передан (данных о поле нет).
function childSubjectWord(genderMode?: 'female' | 'male'): 'girl' | 'boy' | 'child' {
  if (genderMode === 'female') return 'girl';
  if (genderMode === 'male') return 'boy';
  return 'child';
}

function buildChildSubjectBlock(genderMode?: 'female' | 'male'): string {
  const word = childSubjectWord(genderMode);
  return `\
SUBJECT: This is a real ${word}. Preserve their natural, real presentation from the reference
photo — no adult styling cues, no makeup, no adult grooming instructions of any kind. Clothing and
styling stay age-appropriate for a ${word}, never adult-coded.`;
}

// Короткая реплика для full-body (раньше — fullBodyFaceLockBlock на ~2500 символов,
// почти целиком дублировавший FACE GEOMETRY из IDENTITY_LOCK выше). Оставлена только
// уникальная мысль: на дальней дистанции лицо мельче и склонно "плыть" к generic —
// напоминание держать тот же lock, не переупрощая его.
const FULL_BODY_IDENTITY_ADDENDUM = `\
FULL-BODY DISTANCE (reinforcement): at full-body distance the face is smaller in frame and easy
to drift toward a generic look — hold the exact same face-geometry lock above, don't simplify it.
Body proportions, head-to-body ratio, and limb length stay anatomically natural — no elongation,
no slimming, no doll-like proportions, no tiny head.`;

// ── REALISM & ANATOMY (v11) ──────────────────────────────────────────────────
// Объединяет realismBlock + realPhotographyBlock + cinematicRealismBlock +
// уникальную часть bestVersionBlock (~4200 символов вместе) в один блок.
// Новое: явное позитивное требование к рукам/пальцам и посадке одежды —
// раньше это упоминалось только в негативном списке ("broken fingers"), а не
// как позитивная инструкция, хотя пользователь прямо просил "правильные руки
// и пальцы", "реалистичная посадка одежды", "натуральные складки ткани".
const REALISM_AND_ANATOMY = `\
PHOTOGRAPHIC REALISM:
This must read as a real photograph taken by a working photographer — not a render, not CGI, not
an AI illustration. Skin has real texture and a healthy natural glow, not airbrushed plastic
smoothness. Eyes are sharp, alive, with genuine catchlights and visible iris detail — whether they
meet the lens directly or follow the gaze called for by the chosen composition below, they must
never look vacant, glassy, or dead. Hands and fingers are anatomically correct — five fingers,
natural joints, no fused or extra digits. Clothing sits and folds the way real fabric does under
gravity and movement, not like a flat texture wrap. Light and shadow are physically consistent
with a single believable source. Small natural imperfections — asymmetry, a stray hair, an uneven
fold — are welcome; hyper-symmetrical, over-corrected perfection reads as fake.`;

// ── CHARACTER & EMOTION (новое) ──────────────────────────────────────────────
// 8 состояний из ТЗ. На каждую генерацию выбирается РОВНО ОДНО — не весь список,
// поэтому стоимость почти нулевая (одна строка ~150-250 символов), а не +8 блоков.
// "soft_presence" — единственный пункт с гендерной веткой (мягкая женственность
// неуместна для мужского портрета) — заменяется на спокойную мужскую сдержанность.
interface CharacterState { id: string; describe: (isMale: boolean) => string; }

const CHARACTER_STATES: readonly CharacterState[] = [
  { id: 'calm_confidence', describe: (m) =>
    `Calm confidence: settled and composed, weight fully in the body, gaze steady and unhurried, quietly certain of ${m ? 'himself' : 'herself'}.` },
  { id: 'genuine_joy', describe: () =>
    'Genuine joy: a real, unforced warmth in the eyes and the corners of the mouth — authentic delight, not a performed camera smile.' },
  { id: 'focus', describe: () =>
    'Focus: quiet concentration, eyes sharp and present, attention pulled toward something just past the lens — engaged, not a blank stare.' },
  { id: 'creative_energy', describe: () =>
    'Creative energy: alert, curious, faintly playful — the sense of someone mid-thought, alive with an idea.' },
  { id: 'quiet_thoughtful', describe: () =>
    'Quiet thoughtfulness: a soft, inward gaze, unhurried breath — a private moment the camera happened to catch.' },
  { id: 'freedom', describe: () =>
    'Freedom: open, unguarded body language, breath and motion loose, a sense of lightness and release.' },
  { id: 'soft_presence', describe: (m) => m
    ? 'Quiet composure: grounded, unshowy masculine ease — steadiness without needing to prove anything.'
    : 'Soft femininity: gentle, warm, unforced grace in the posture and gaze — tenderness without performance.' },
  { id: 'strength_leadership', describe: () =>
    'Strength and leadership: shoulders open, gaze direct and unwavering, the presence of someone used to being listened to.' },
];

function pickCharacterState(isMale: boolean): string {
  return pickFromArray(CHARACTER_STATES).describe(isMale);
}

// ── ACTION (новое) ────────────────────────────────────────────────────────────
// Конкретные, привязанные к кадрированию действия — раньше живость держалась
// только на POSES_PORTRAIT/FULLBODY (в основном про положение тела, почти без
// взаимодействия с предметами). Разделены на portrait/full-body, чтобы не
// просить "идёт по улице" в кадре, обрезанном по грудь.
// ВАЖНО: ни одно действие не описывает направление взгляда — за это отвечает
// ТОЛЬКО COMPOSITION (см. ниже). Раньше здесь были формулировки вроде "glancing
// back toward the camera" / "attention drifting up toward the lens", которые
// при случайном сочетании с профильной/смотрящей-в-сторону композицией давали
// прямое противоречие ("смотрит на камеру" + "смотрит в сторону" одновременно).
// ACTION — только про руки/тело/предметы, COMPOSITION — про кадр и взгляд.
const ACTIONS_PORTRAIT: readonly string[] = [
  'adjusting an earring or a loose strand of hair with one hand',
  'fingertips resting lightly at the collar, mid-gesture',
  'holding a cup or glass just below the chin, caught mid-sip or mid-thought',
  'gently adjusting a sleeve or cuff',
  'shoulders turning slightly, weight shifting mid-motion',
  'one hand lightly touching the opposite shoulder, mid-turn',
  'holding a phone loosely in one hand, thumb paused mid-scroll',
  'resting a forearm on a table or ledge, leaning in slightly',
  'caught between expressions, as if mid-sentence',
  'taking off or putting on a pair of glasses',
];

const ACTIONS_FULLBODY: readonly string[] = [
  'caught mid-step, walking naturally toward or across the frame',
  'shoulders and torso turning, weight shifting mid-motion',
  'leaning back against a wall or column, weight settled on one leg',
  'sitting and leaning slightly forward, elbows near the knees',
  'resting a hand on a table, chair, or railing while shifting weight',
  'pausing beside a window or doorway, one hand near the frame',
  'gesturing naturally with one hand, as if mid-conversation',
  'pausing mid-motion, coat or hair still settling from a step',
];

// keepHeadFrontal=true (только bw_portrait — см. isFrontalLocked в buildPrompt())
// вырезает единственное действие, подразумевающее поворот головы ("over one
// shoulder"), чтобы не спорить с зафиксированной фронтальной композицией.
function pickAction(isFullBody: boolean, keepHeadFrontal = false): string {
  const pool = isFullBody ? ACTIONS_FULLBODY : ACTIONS_PORTRAIT;
  const safePool = keepHeadFrontal ? pool.filter((a) => !/shoulder/i.test(a)) : pool;
  return pickFromArray(safePool.length ? safePool : pool);
}

// ── ENVIRONMENT INTERACTION (новое) ──────────────────────────────────────────
// GENERAL безопасен для любой сцены, включая закрытый студийный фон (без ветра/
// улицы). SCENE — только для открытых/предметных локаций (editorial, lifestyle),
// не используется для isSocialPortrait (студийный фон из BACKGROUNDS_SOCIAL).
const ENV_INTERACTION_GENERAL: readonly string[] = [
  'Light falls across the face from a clear, identifiable direction — the kind of light you could point to.',
  'A soft natural shadow on the near side of the face gives real dimension, not flat frontal flatness.',
  'The background holds genuine depth — a natural separation between subject and surroundings, not a flat cutout.',
  'The fabric of the outfit shows natural, physically believable weight and folds, not a flat digital texture.',
];

const ENV_INTERACTION_SCENE: readonly string[] = [
  'A light breeze lifts a few strands of hair or stirs the fabric of the outfit.',
  'One hand rests naturally against a nearby surface — a table, railing, wall, or chair.',
  'The person is genuinely inhabiting the space — passing through it, not standing in front of a backdrop.',
  'Shadows and light on the body follow the real geometry of the surrounding space.',
];

function pickEnvironmentInteraction(allowScene: boolean): string {
  const pool = allowScene ? [...ENV_INTERACTION_GENERAL, ...ENV_INTERACTION_SCENE] : ENV_INTERACTION_GENERAL;
  return pickFromArray(pool);
}

// ── COMPOSITION (новое) ──────────────────────────────────────────────────────
// Раньше вариативность кадра сводилась к одному булеву флагу isFullBody
// ("Portrait composition: head and shoulders, magazine cover style." — сам
// текст подталкивал к центрированному кадру) плюс глобальному запрету
// "avoid strong head turns, profiles" на ВСЕ стили без исключения — это и есть
// главная причина статичных фронтальных фото. Теперь: для style'ей без
// доказанной чувствительности к развороту головы (см. isFrontalLocked ниже,
// это ТОЛЬКО social_portrait — v7 commit истории этого проекта явно
// зафиксировал регресс identity при повороте головы именно для этого стиля и
// откатил его) разрешены три четверти/профиль/взгляд в сторону. Для остальных
// clean-portrait (bw_portrait) и обычных editorial — полная вариативность.
const COMPOSITIONS_CLEAN_PORTRAIT: readonly string[] = [
  'Tight close-up crop — the face fills most of the frame, head and top of shoulders only.',
  'Close portrait crop with a little more air around the head — face and shoulders, slightly off-center in the frame.',
  'Waist-up crop, body turned slightly to one side while the face stays frontal to the camera.',
];

// v13 (full-catalog audit fix): раньше был ровно 1 вариант — 0% вариативности
// full-body композиции для bw_portrait. Добавлены ещё 3, тот же строгий
// frontal-lock головы (не тронут — это единственная подтверждённая практикой
// чувствительная точка, см. isFrontalLocked выше), варьируется только тело/вес/кадр.
const COMPOSITIONS_CLEAN_PORTRAIT_FULLBODY: readonly string[] = [
  'Full-body crop, body turned slightly to one side, face frontal to the camera, natural standing weight on one leg.',
  'Full-body crop, standing straight and centred, face frontal to the camera, arms relaxed at the sides.',
  'Full-body crop, seated naturally on a stool or ledge, face frontal to the camera, calm grounded posture.',
  'Full-body crop, one shoulder leaning lightly against a wall or surface, face frontal to the camera, relaxed stance.',
];

const COMPOSITIONS_STANDARD_PORTRAIT: readonly string[] = [
  'Tight beauty close-up, direct gaze into the lens.',
  'Waist-up portrait, body turned three-quarters, face turned back toward the camera.',
  'Waist-up portrait, gaze directed just past the camera toward the light — a candid, unposed feel.',
  'Clean profile composition — face in a true side view, gaze forward into the distance, not at the lens.',
  'Slightly off-center portrait crop, asymmetrical framing, direct eye contact.',
];

const COMPOSITIONS_STANDARD_FULLBODY: readonly string[] = [
  'Full-body composition, walking naturally with a slight off-center frame.',
  'Full-body composition, three-quarter body turn, head turned back toward the camera over one shoulder.',
  'Full-body composition, seated or leaning, gaze directed away from the lens into the scene.',
  'Full-body profile silhouette against the environment, gaze forward, not at the camera.',
  'Three-quarter-length composition (knees up), body at a natural angle, direct gaze into the lens.',
];

// ── SOCIAL PORTRAIT COMPOSITION (v12, living beauty workflow) ────────────────
// social_portrait used to be fully frontal-locked (see isFrontalLocked history:
// v7 "revert corpus 3/4 (pulled head turn)" — a real identity regression was
// observed with the FULL COMPOSITIONS_STANDARD_PORTRAIT pool, which allows true
// profile and strong three-quarter turns). This pool is a deliberately narrower
// middle ground: bounded head turn/tilt and off-center framing (the "safe
// variability" the owner asked for), but never true profile, never an extreme
// angle, never full body — the specific things that regressed identity before.
const COMPOSITIONS_SOCIAL_PORTRAIT: readonly string[] = [
  'Direct gaze into the lens, shoulders turned slightly to one side — a natural, unposed angle.',
  'Head turned gently into a soft three-quarter angle, eyes still finding the camera.',
  'A small natural head tilt, warm and relaxed, gaze meeting the lens.',
  'Gaze resting just past the camera, as if caught in a genuine unguarded moment.',
  'Portrait crop slightly off-center, close-up or waist-up, natural asymmetry in the frame.',
  'Close-up crop, face turned a few degrees off frontal, direct warm eye contact.',
  'Waist-up crop, one shoulder slightly forward, head softly turned toward the lens.',
];

function pickComposition(isFullBody: boolean, isCleanPortrait: boolean): string {
  if (isCleanPortrait) {
    return pickFromArray(isFullBody ? COMPOSITIONS_CLEAN_PORTRAIT_FULLBODY : COMPOSITIONS_CLEAN_PORTRAIT);
  }
  return pickFromArray(isFullBody ? COMPOSITIONS_STANDARD_FULLBODY : COMPOSITIONS_STANDARD_PORTRAIT);
}

// ── MAGNETIC PRESENCE (v11) ───────────────────────────────────────────────────
// Объединяет magnetismBlock + femininityBlock (раньше два раздельных блока с
// заметным смысловым перекрытием — оба про "спокойная сила без демонстрации").
const presenceBlock = `\
MAGNETIC PRESENCE:
She feels emotionally powerful, calm, self-possessed, and quietly magnetic — her presence draws
attention without reaching for it. Expression: composed, subtly warm, a sense of an inner world
the viewer can't fully see. Luxury reads as restraint and confidence, not exposure — expensive
rather than performative.
Avoid: exaggerated seduction, influencer expressions, artificial sexiness, escort or nightclub
energy, vulgar glamour, explicit sexuality, excessive exposure, emotionally empty posing.`;

export function buildPrompt(input: BuildPromptInput): string {
  // Filter user wish — backend enforcement, cannot be bypassed from browser.
  // Raw customPrompt is stored in DB for audit; filtered version goes to AI.
  const filteredWish = filterWish(input.customPrompt);

  // Нейтральная подсказка по кадрированию — используется только в lifestyle-ветке
  // (детские стили), у которой нет своего пула COMPOSITIONS_*. Editorial и
  // clean-portrait получают кадрирование через pickComposition() ниже.
  const lifestyleFramingHint = input.isFullBody
    ? 'Full-body framing: include the subject from head to feet.'
    : 'Portrait framing: head and shoulders.';

  // Определяем режим один раз — используется для условных блоков ниже.
  const isEditorial = detectIsEditorial(input.stylePrompt, input.styleCategory, input.styleId);
  const isMale = input.genderMode === 'male';
  const isFullBody = !!input.isFullBody;

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
REFERENCE PHOTO — HOW TO USE IT:
Extract from the reference photo: face geometry, hair (cut, color, length), body type, age, skin tone.
COMPLETELY REPLACE in the output: background, location, clothing, furniture, setting — everything around the person.
The background/environment from the reference photo MUST NOT appear in the output. Replace it entirely with the premium location from the style.
Rule: take the PERSON, place them in a completely new premium scene.`;

  // identityBlock/realismBlock/realPhotographyBlock/fullBodyFaceLockBlock объединены
  // в top-level IDENTITY_LOCK / FULL_BODY_IDENTITY_ADDENDUM / REALISM_AND_ANATOMY —
  // см. определение выше (v11, устраняет 4-кратное дублирование identity-текста).

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

  // candorBlock/magnetismBlock/femininityBlock/eyeContactBlock/cinematicRealismBlock/
  // bestVersionBlock объединены в top-level presenceBlock + REALISM_AND_ANATOMY +
  // IDENTITY_LOCK's acceptance test (v11) — четыре block'а почти дословно повторяли
  // "не CGI / не пластик / живые глаза", а candorBlock's "не ходить" теперь снят:
  // ACTIONS_FULLBODY явно описывает "caught mid-step, walking naturally" как
  // допустимое действие для full-body композиции.

  const antiCheapBlock = `\
ANTI-CHEAP LUXURY:
Luxury must feel quiet, restrained, editorial, cinematic, emotionally intelligent, timeless.
Avoid: flashy rich aesthetics, fake billionaire visuals, gold overload, casino luxury, cheap glamour, influencer posing, fast fashion energy, hypersexual styling.`;

  // v11: описания локаций сжаты в однострочники (было ~2760 символов, стало ~1250) —
  // название и материал/свет сохранены, декоративные повторы убраны.
  const premiumLocationBlock = `\
LOCATION — MANDATORY SELECTION (choose exactly one, no other location exists):
1. Luxury penthouse — floor-to-ceiling glass, Manhattan/city skyline, warm amber light, high above the city.
2. Five-star hotel suite — marble floors, tall windows, golden light, timeless architectural luxury.
3. Vogue editorial studio — seamless grey/cream/deep-tone backdrop, dramatic controlled light.
4. Luxury business lounge — private members club, dark leather, brass, warm light, no other guests.
5. Private jet interior — cream leather seats, oval windows, clouds outside, warm golden cabin light.
6. Yacht deck — Mediterranean or modern waterfront, ocean horizon, golden hour, chrome railings.
7. Rooftop skyline terrace — city panorama at golden hour/twilight, glass or concrete railing.
8. Designer architectural interior — sculptural space, marble/terrazzo, high ceilings, no clutter.
9. Premium fashion campaign set — bold backdrop or architectural set, editorial dramatic light.
10. Luxury Manhattan office — floor-to-ceiling glass, NY skyline, executive power atmosphere.
11. Milan fashion district — cobblestone piazza, luxury boutique facades, golden afternoon light.
12. Paris luxury street — Haussmann stone architecture, golden afternoon light, soft bokeh.

QUALITY STANDARD: every element — light source, architecture, surface, atmosphere — signals premium
quality before the viewer consciously notices anything else. She belongs in this space, not visiting it.
LIGHTING: 85mm lens, shallow depth of field, cinematic directional light. Magazine quality.`;

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
  // FIX (migration 020): после migration 009 prompt стиля old_money начинается с [LUXURY DAYLIGHT],
  // а не с «тихая роскошь». Добавляем LUXURY DAYLIGHT в regex, чтобы oldMoneyEstateBlock
  // применялся и давал scene variety (countryside, horses, cashmere, Range Rover).
  // LUXURY DAYLIGHT уникален — только old_money использует этот тег, побочных срабатываний нет.
  const isOldMoneyEstate = isEditorial &&
    /ТИХАЯ РОСКОШЬ|LUXURY DAYLIGHT|тихая.*роскошь|quiet.*luxury.*lifestyle|old.*money.*lifestyle/i.test(input.stylePrompt);

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

  // SOCIAL PORTRAIT / ОБРАЗ ДЛЯ СОЦСЕТЕЙ — привлекательный portrait для соцсетей и личного бренда.
  // Отключает тяжёлые luxury-editorial блоки (aura, fashion, magnetism, femininity, antiCheap).
  // Сохраняет: identity, realism, editorialBlock (композиция), candorBlock, eyeContact, cinematicRealism.
  //
  // v12 (living beauty workflow, fix для жалобы на статичный "документальный" результат):
  // до этой версии socialPortraitBlock содержал СОБСТВЕННЫЙ "NO BEAUTY TRANSFORMATION" и
  // "HEAD ANGLE — CRITICAL" блок, который прямо противоречил новой концепции (запрещал
  // омоложение/ретушь и жёстко фиксировал фронтальность головы) — независимо от
  // IDENTITY_LOCK/buildNegativePrompt() выше по файлу. CHARACTER и ENVIRONMENT INTERACTION
  // уже были подключены и раньше; теперь добавлены ACTION (безопасен по дизайну — только
  // руки/тело, не взгляд) и свой COMPOSITIONS_SOCIAL_PORTRAIT пул (ограниченная вариативность
  // взамен жёсткого frontal-lock — см. комментарий у isFrontalLocked). Второй, полностью
  // независимый путь — buildSocialPortraitMinimalPrompt() за флагом SOCIAL_PORTRAIT_MINIMAL —
  // этой правкой не затронут; см. отдельный аудит по нему.
  const isSocialPortrait = isEditorial &&
    /PREMIUM INFLUENCER PORTRAIT|ОБРАЗ ДЛЯ СОЦСЕТЕЙ|social.portrait|ИДЕАЛЬНЫЙ КАДР|clean.authentic.portrait|personal.brand.*portrait/i.test(input.stylePrompt);

  // ЧЁРНО-БЕЛЫЙ ПОРТРЕТ — timeless monochrome studio portrait.
  // Как social portrait: отключает тяжёлые luxury-блоки.
  // Дополнительно: вставляет блок принудительного B&W вывода.
  //
  // FIX (migration 020): двойная защита от деградации при пустом prompt.
  //   Сигнал 1: keyword в stylePrompt (основной путь — prompt из БД начинается с [TIMELESS PORTRAIT]).
  //   Сигнал 2: styleId === 'bw_portrait' (страховка — срабатывает даже если prompt пустой
  //             в bundle-fallback режиме или при ошибке применения миграции).
  // Оба сигнала независимы — достаточно одного для активации B&W-блока.
  const isBWPortrait = isEditorial && (
    /TIMELESS PORTRAIT|ЧЁРНО-БЕЛЫЙ|bw.portrait|monochrome.*portrait|grayscale.*portrait/i.test(input.stylePrompt)
    || input.styleId === 'bw_portrait'
  );

  // Общий флаг: оба portrait-режима отключают одни и те же luxury-блоки.
  const isCleanPortrait = isSocialPortrait || isBWPortrait;

  // ── MEN CINEMATIC SERIES ────────────────────────────────────────────────────
  // Активируется для 4 стилей MEN Premium (тег [MEN:] в stylePrompt + isMale).
  // Заменяет женские luxury/aura/fashion блоки мужскими cinematic блоками.
  const isMenCinematic = isMale && isEditorial &&
    /\[MEN:/i.test(input.stylePrompt);

  const isMasterOfLife = isMenCinematic && /MASTER OF LIFE/i.test(input.stylePrompt);

  // Мужская идентичность без prescription одежды — одежда описана в stylePrompt сцены.
  const menGenderBlock = `\
MASCULINE IDENTITY (required):
This is a male portrait. The subject is a man.
Generate exclusively masculine presentation exactly as described in the scene.
Grooming: clean masculine — neat hair, clean shave or light stubble appropriate to the character.
No makeup. No feminine styling. No feminine body proportions.
Presence: confident, grounded, raw masculine energy as described in the scene.
FORBIDDEN: any feminine styling, feminine makeup, female body proportions, feminine silhouette, woman's clothing.`;

  const menCinematicBlock = `\
MEN CINEMATIC QUALITY (mandatory for this style):
This must feel like a frame from a premium cinematic commercial campaign — NOT a generic AI male render.

SKIN & FACE:
- Realistic masculine skin texture: natural pores, subtle stubble if appropriate, warm authentic tones.
- FORBIDDEN: plastic skin, over-smoothed face, wax male face, CGI male model, artificial male beauty filter.
- Do NOT over-beautify or feminize the face. Preserve the subject's real masculine features exactly.
- Jawline, facial structure, skin quality — all preserved from reference.

BODY:
- Preserve the user's natural body type and proportions from the reference photo.
- DO NOT transform into a bodybuilder, fitness model, or unrealistic muscular physique.
- Slim reference → lean athletic build. Heavier reference → broad masculine build.
- Realistic anatomy: correct head-to-body ratio, natural proportions, believable posture.

EXPRESSION & EMOTION:
- Authentic masculine emotion: calm dominance, confident joy, silent power, raw triumph, adventurous freedom.
- Eyes: alive, expressive, direct camera gaze. Real human masculine energy.
- NOT: blank model stare, artificial commercial smile, empty generic expression.

SCENE & PROPS:
- Background must be cinematic, detailed and immersive — not empty or generic.
- Environment must feel REAL: real canyon, real lake, real yacht deck, real savanna cliff.
- All props must be photorealistic with correct anatomy, texture and believable scale.

FINAL STANDARD: Premium luxury advertising campaign — shot by a top photographer. Real. Cinematic. Powerful.`;

  const menLionBlock = `\
LION DIRECTION (MASTER OF LIFE — critical):
The lion is a HUGE majestic adult male lion with a full dense mane — rendered with PHOTOGRAPHIC REALISM.
The lion is a cinematic symbol of power and mastery — NOT a prop, NOT a pet, NOT a zoo animal.
Realistic lion anatomy: correct proportions, detailed fur texture, natural musculature, believable weight and scale.
The lion stands or sits beside the man — NOT attacking, NOT hugging, NOT posed unnaturally.
The lion's scale must feel enormous and physically imposing relative to the man.
Both man and lion face the camera — shared calm composure, cinematic dominance.
FORBIDDEN: cartoon lion, CGI fantasy lion, small lion, lion touching man, zoo or cage aesthetic, illustrated animal.`;

  // ── MEN CINEMATIC: чистые мужские замены женских editorial блоков ──────────
  // Заменяют editorialBlock, candorBlock, realPhotographyBlock + переопределяют
  // makeup-строку из identityBlock — полностью убирают женские элементы из MEN пути.

  // Заменяет editorialBlock ("Vogue / Harper's Bazaar" — женские журналы).
  const menEditorialBlock = `\
MEN CINEMATIC EDITORIAL (masculine standard):
Shoot this as a working professional photographer for a premium men's publication — GQ, Esquire, National Geographic, Men's Journal.
Posing: dynamic, powerful and natural. Confident masculine weight shift, grounded stance.
The man is caught in a real moment — alive, purposeful, present. Not posed for a passport.
Composition: cinematic off-center framing, editorial rule-of-thirds, commanding negative space.
Avoid static symmetric headshots. Avoid flat corporate portrait framing.
Depth of field: shallow to medium, cinematic background separation, realistic lens compression (85–135mm feel).
Lighting: masculine cinematic — golden hour, dramatic directional light, atmospheric natural light, sun flare.
No flat even studio lighting. No generic empty background.
Atmosphere: GQ / National Geographic adventure editorial energy. Premium masculine visual language.
Powerful and cinematic — shot on a real camera, by a real photographer, in a real decisive moment.`;

  // Заменяет candorBlock ("should NOT walk, stride" — ограничение для женских fashion shots).
  // MEN cinematic — мужское движение ПРИВЕТСТВУЕТСЯ.
  const menCandorBlock = `\
MASCULINE PRESENCE (authentic):
Natural grounded masculine posture — weight shift, confident stance, authentic body alignment.
Calm powerful presence radiating from within — not theatrical, not performative, not stiff.
Subject may stand, lean, walk, stride, or move naturally in the scene.
Masculine movement energy is encouraged — dynamic alive energy is a strength, not a flaw.
Avoid rigid mannequin posture. Avoid passive static freezing.
The man must feel alive, purposeful, dynamically present — a real man in a real powerful moment.`;

  // Заменяет realPhotographyBlock ("Vogue / Harper's Bazaar / Condé Nast" — женские журналы).
  const menRealPhotographyBlock = `\
REAL PHOTOGRAPHY FEEL — MASCULINE (mandatory):
This image must feel like it was captured by a real professional photographer on a real men's editorial shoot — not generated by AI.
The viewer must sense: a real man was photographed in a real powerful moment.

WHAT MUST BE PRESENT:
Captured decisive moment: the man feels caught mid-action, mid-breath — alive and present.
Natural masculine body tension: authentic weight, relaxed muscle, real confident asymmetry.
Authentic masculine posture: natural spine, weight shift, a real man standing in a real space.
Natural skin response to lighting: realistic texture, micro-shadows, visible skin detail — not airbrushed.
Emotional realism: masculine confidence, quiet power, adventurous joy, real emotion radiating outward.
Imperfect human beauty: natural masculine asymmetry, real facial character — not AI-smoothed.
Cinematic masculine depth: the man has strength, personality, presence beyond the frame.
Premium men's photography: GQ / National Geographic / Men's Journal / Esquire real photoshoot aesthetic.

THE VIEWER MUST FEEL: "This was shot by a top photographer on a real adventure — not generated by AI."

FORBIDDEN:
Mannequin stiffness, frozen posture, plastic AI male energy.
Over-smoothed hyper-perfect artificial male skin — looks generated, not photographed.
CGI male model aesthetic instead of a real masculine human being.
Plastic skin without texture, airbrushed face without natural masculine detail.`;

  // Добавляется ПОСЛЕ identityBlock в MEN пути — явно переопределяет "makeup allowed".
  // identityBlock содержит в ALLOWED grooming: "Style-appropriate makeup applied naturally over the real face."
  // Для мужчин это неприемлемо.
  const menGroomingBlock = `\
MEN GROOMING (strictly no makeup):
Natural masculine grooming ONLY — neat styled hair, clean shave or appropriate stubble for the character.
NO MAKEUP of any kind. NO beauty filter. NO feminine grooming. NO eyeliner. NO foundation.
Preserve natural masculine skin texture — real pores, authentic skin tones, natural masculine character.
The face must look like a real man's face — NOT a smoothed AI male model, NOT a beauty-filtered face.`;

  // Variety picks — randomised once per buildPrompt() call so every generation
  // gets a unique outfit + pose + background combination for social_portrait.
  const _spOutfit = isSocialPortrait
    ? pickFromArray(isMale ? WARDROBE_SOCIAL_MALE : WARDROBE_SOCIAL_FEMALE)
    : '';
  const _spPose = isSocialPortrait ? pickFromArray(POSES_SOCIAL_PORTRAIT) : '';
  const _spBg   = isSocialPortrait ? pickFromArray(BACKGROUNDS_SOCIAL) : '';

  const socialPortraitBlock = `\
PREMIUM SOCIAL MEDIA PORTRAIT — LUXURY FASHION STYLIST STANDARD:
Every generation must look like a professional photoshoot created by a luxury fashion stylist.
Photo quality: ultra-realistic photography, Vogue-level, professional premium retouching.
Natural skin texture — real pores, healthy warm glow. Not AI-looking. Not stylized. Not CGI.

LOCK FACE GEOMETRY — NON-NEGOTIABLE (exact match, no drift either direction):
Copy the following exactly from the reference photo. Do not interpret. Do not improve. Copy.
- face length & width: EXACTLY as the reference — not longer/shorter, not wider/narrower
- preserve the natural elongated oval and high cheekbone position exactly as the reference
- jaw width & chin: exact reference contour — do not slim into a V, do not broaden or round
- cheek volume: exactly as the reference — do not add fullness, do not hollow
- eye shape: exact eyelid contour, size, natural openness
- eye color: exact iris color from reference
- eye distance: exact spacing between eyes
- nose bridge width and nose tip: exact same form
- lip proportions: exact upper-to-lower ratio, exact natural width

DO NOT (in EITHER direction) — geometry only, see BEAUTY & FRESHNESS below for skin/age:
- make the face slimmer OR wider
- make the face longer OR rounder/shorter
- make the jaw more angular OR more broad
- add OR reduce cheek volume

EXACT FACE ANATOMY MATCH (refer strictly to the reference photo):
1. EYES: keep the exact eye shape, size and depth from the reference. The gaze must be deeply alive,
   warm and present, with natural prominent specular highlights (real lens catchlights) inside the eyes.
   Do NOT distort the eyebrows. Do NOT pull the outer eye corners upward into a stylized look.
2. LIPS: keep the authentic natural width of the lips from the reference. Lips relaxed and naturally
   resting — do NOT stretch them wider, do NOT bloat or over-plump, no pinched corners,
   no synthetic over-sharp lipstick contouring.
3. FACE SHAPE & LIGHT: preserve the exact reference oval — the natural vertical elongation and high
   cheekbones — without widening or rounding. Use soft natural portrait light that follows the true
   reference structure. Eliminate harsh nasolabial / under-cheek shadows that add stiffness or aging.
   Skin soft and radiant under even premium diffused light.

REFERENCE PHOTO USAGE:
The uploaded photo is the facial identity reference.
PRESERVE EXACTLY from the reference photo: face shape, jaw width, chin shape, lower face
proportions, cheek volume, eye shape and color, eye spacing, nose shape, lip shape,
jawline, skin tone, facial asymmetry, hair length and hair color, body type. Age stays within the
same broad recognizable category — see BEAUTY & FRESHNESS below for how much freshness is allowed.
The generated person must be immediately recognisable as the same individual from the reference.
Face identity similarity must remain above 95%.

BEAUTY & FRESHNESS (aligned with IDENTITY_LOCK — this is a flattering portrait, not a passport scan):
Within the exact geometry locked above, this generation should look like the person's best,
most attractive day: clean, even, radiant skin; a fresh, well-rested under-eye area; gently
softened fatigue and age markers (never a different generation — see IDENTITY_LOCK); professional,
natural-looking makeup suited to this person's coloring; hair styling — volume, waves, a polished
finish — refined without changing the cut, length, or colour from the reference. Professional,
tasteful beauty retouching is expected and welcome, not a defect to avoid.
Still forbidden: replacing this person with a different-looking face, generic "model" idealization,
or a cheap/obvious filtered look — see the global AVOID list at the end of this prompt.

OUTFIT FOR THIS GENERATION (use exactly — no substitution):
${_spOutfit}
Completely replace ALL clothing from the reference photo with this specific premium outfit.
Fit perfectly to this person's exact body type and proportions.
Expensive fabric texture must be clearly visible — silk sheen, knit texture, tailoring structure.
Color must harmonise naturally with this person's skin tone and hair color.
Accessories and details must be refined and cohesive — nothing generic or fast fashion.
The viewer must immediately feel: "A luxury fashion stylist chose this outfit personally."
FORBIDDEN: any trace of original clothing, fast fashion energy, generic basics, sportswear.

BACKGROUND FOR THIS GENERATION (use exactly):
${_spBg}
Replace original background entirely.
FORBIDDEN: cheap cafes, restaurant tables, random coffee shops, amateur home environments,
cartoon or painted backgrounds, low-quality textures.

POSE FOR THIS GENERATION:
${_spPose}
Natural, confident, approachable — genuinely alive, not stiff, not runway, not corporate.
Expression: warm and genuine. A natural smile is welcome, including a soft smile with teeth if it
reads as believable and unforced — never a stiff or performed camera smile.
Head angle and framing for this generation are set by the COMPOSITION line elsewhere in this
prompt — follow that, not a fixed frontal default.

LIGHTING:
Natural soft light — window quality, clean premium studio glow, or lifestyle setting light.
Flattering to face and fabric texture. Skin: warm, healthy, alive.
NO harsh shadows. NO neon. NO dramatic contrast. NO colored gels.
Shallow depth of field — 85–105mm portrait lens feel.

MAKEUP HYGIENE (critical render rule):
Lipstick stays ONLY on the lips — crisp clean lip line.
TEETH must be completely clean: natural white, NO lipstick stains, NO red marks, NO color bleed onto teeth.
Makeup must look professionally applied — no smearing, no bleeding outside natural borders.

CAMERA QUALITY (medium-format standard):
Render as if shot on a medium-format studio camera (Hasselblad quality):
tack-sharp focus on the eyes, crisp visible fabric weave and knit texture,
fine natural skin detail, smooth tonal transitions, zero digital noise.
Muted refined color grading — calm, expensive, timeless. Not oversaturated, not glossy-digital.

RESULT GOAL:
This person must look like the BEST REAL VERSION OF THEMSELVES.
Not another person. Not AI-looking. Not over-stylized beyond recognition.
The result must look like a real professional photoshoot that could be published
in a luxury lifestyle magazine or premium social media.`;


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
  const menAvoidExtra = isMenCinematic
    ? ', makeup, beauty filter, eyeliner, mascara, lipstick, foundation, female grooming'
      + ', artificial bodybuilder physique, unrealistic muscle mass, gym selfie aesthetic'
      + ', cheap AI male render, plastic male face, CGI male face, male wax figure, fitness model body swap'
      + ', female silhouette, female body proportions, feminine styling, feminine clothing'
      + ', Vogue aesthetic, Harper\'s Bazaar styling, female fashion campaign energy'
      + (isMasterOfLife ? ', cartoon lion, CGI lion, fantasy lion, small lion, illustrated lion, zoo aesthetic, cage background' : '')
    : '';
  const avoidBlock = `AVOID: ${buildNegativePrompt()}${isEditorial ? '' : lifestyleAvoidExtra}${fullBodyAvoidExtra}${genderAvoidExtra}${menAvoidExtra}`;

  // Только bw_portrait сохраняет строгую фронтальность головы через общий
  // COMPOSITIONS_CLEAN_PORTRAIT/pickComposition() механизм.
  // Причина: v7 в истории коммитов этого проекта явно зафиксировал регресс
  // identity при развороте головы для social_portrait при ПОЛНОЙ вариативности
  // (COMPOSITIONS_STANDARD_PORTRAIT — профиль, сильные три четверти) и откатил
  // его ("revert corpus 3/4 (pulled head turn), energy via gaze not angle").
  // bw_portrait — тот же тип продукта (точный headshot), поэтому для него
  // сохранена та же осторожность.
  // v12 (living beauty workflow): social_portrait больше не полностью
  // frontal-locked и не отключён от ACTION/COMPOSITION — ему нужна была не
  // "никакой вариативности", а вариативность БЕЗ той конкретной регрессии.
  // Получает СВОЙ отдельный COMPOSITIONS_SOCIAL_PORTRAIT пул (безопасная
  // середина: лёгкий поворот/наклон головы, взгляд мимо камеры, кадр не по
  // центру — но без профиля/экстремального ракурса, которые и вызвали регресс).
  const isFrontalLocked = isCleanPortrait;

  // Единая точка выбора "живых" элементов фотосессии — по одному значению на
  // генерацию каждый, не весь список целиком (дёшево по символам).
  const characterStateLine = isEditorial ? pickCharacterState(isMale) : '';
  const envInteractionLine = pickEnvironmentInteraction(!isCleanPortrait);
  // ACTION — безопасен для social_portrait: пул ACTIONS_PORTRAIT по дизайну
  // (см. комментарий выше) описывает только руки/тело/предметы, никогда взгляд
  // или поворот головы — так что не спорит с COMPOSITIONS_SOCIAL_PORTRAIT.
  // Не для MEN (свой pickMenPose уже несёт оба измерения).
  const wantsGenericAction = isEditorial && !isMenCinematic;
  const actionLine = wantsGenericAction ? pickAction(isFullBody, isBWPortrait) : '';
  // COMPOSITION — social_portrait получает свой узкий "safe variability" пул;
  // bw_portrait и обычный editorial — прежний механизм без изменений.
  const compositionLine = isSocialPortrait
    ? pickFromArray(COMPOSITIONS_SOCIAL_PORTRAIT)
    : (isEditorial && !isMenCinematic)
      ? pickComposition(isFullBody, isFrontalLocked)
      : '';

  return [
    referenceBlock,
    '',
    isEditorial ? IDENTITY_LOCK : CHILD_IDENTITY_LOCK,
    '',
    // MEN: явный запрет макияжа — переопределяет нейтральную формулировку gender-блока
    ...(isMenCinematic ? [menGroomingBlock, ''] : []),
    // Lifestyle (дети): buildChildSubjectBlock() вместо genderPositiveBlock/menGenderBlock —
    // те говорят "This is a female/male portrait. The subject is a woman/man" и разрешают
    // макияж/бритьё, что неуместно для ребёнка. isMenCinematic всегда false здесь
    // (сам требует isEditorial), поэтому ветка ниже безопасна.
    isEditorial ? (isMenCinematic ? menGenderBlock : genderPositiveBlock) : buildChildSubjectBlock(input.genderMode),
    '',
    ...((isFullBody || isMenCinematic) ? [FULL_BODY_IDENTITY_ADDENDUM, ''] : []),
    REALISM_AND_ANATOMY,
    '',
    // ── Editorial-only блоки ──────────────────────────────────────────────────
    ...(isEditorial
      ? isMenCinematic
        ? [
            // MEN: 100% мужские editorial блоки.
            menEditorialBlock, '',
            menCandorBlock, '',
            menRealPhotographyBlock, '',
            antiRepetitionBlock, '',
            menCinematicBlock, '',
            ...(isMasterOfLife ? [menLionBlock, ''] : []),
            `CHARACTER: ${characterStateLine}`, '',
            `ENVIRONMENT INTERACTION: ${envInteractionLine}`, '',
          ]
        : [
            // Стандартные editorial блоки
            ...(!isCleanPortrait ? [auraBlock, ''] : []),
            ...(!isCleanPortrait ? [luxuryAdaptBlock, ''] : []),
            editorialBlock, '',
            ...(!isCleanPortrait ? [fashionBlock, ''] : []),
            ...(!isCleanPortrait && !isMale ? [presenceBlock, ''] : []),
            ...(!isCleanPortrait ? [antiCheapBlock, ''] : []),
            antiRepetitionBlock, '',
            ...(!isCleanPortrait ? [premiumLocationBlock, ''] : []),
            ...(isSummerCity ? [summerCityBlock, ''] : []),
            ...(isFutureLuxury ? [futureLuxuryBlock, ''] : []),
            ...(isWildLuxury ? [wildLuxuryBlock, ''] : []),
            ...(isOldMoneyEstate ? [oldMoneyEstateBlock, ''] : []),
            ...(isGoddess ? [goddessBlock, ''] : []),
            ...(isEliteSport ? [eliteSportBlock, ''] : []),
            ...(isSocialPortrait ? [socialPortraitBlock, ''] : []),
            ...(isBWPortrait ? [bwPortraitBlock, ''] : []),
            `CHARACTER: ${characterStateLine}`, '',
            `ENVIRONMENT INTERACTION: ${envInteractionLine}`, '',
            ...(actionLine ? [`ACTION: ${actionLine}`, ''] : []),
            ...(compositionLine ? [`COMPOSITION: ${compositionLine}`, ''] : []),
          ]
      : [
          childLifestyleBlock, '',
          ...(isLittleCeoGirl ? [littleCeoGirlBlock, ''] : []),
          `ENVIRONMENT INTERACTION: ${envInteractionLine}`, '',
          lifestyleFramingHint,
        ]),
    // ── Состав и технические параметры ───────────────────────────────────────
    // OUTFIT + PERSONAL COLOR ADAPTATION:
    ...(isMenCinematic
      ? [`OUTFIT: ${pickMenWardrobe(input.stylePrompt)} — wear exactly as described in the scene, no substitution.`]
      : isEditorial && !isCleanPortrait
        ? [
            `OUTFIT INSPIRATION: ${pickEnvironmentAwareGarment(filteredWish, input.genderMode)} — silhouette and style suited to the scene environment, feel personally chosen for this person.`,
            buildColorInstruction(filteredWish),
          ]
        : []),
    // POSE — общая физичность позы (дополняет ACTION/COMPOSITION выше, не заменяет):
    // P2: женские editorial стили используют pickFemaleEditorialPose() — она возвращает
    // style-specific позы для БОГИНЯ/МОНАКО/РОМАНТИКА/ДИКАЯ ПРИРОДА, иначе — общий пул.
    ...(isMenCinematic
      ? [`POSE: ${pickMenPose(input.stylePrompt)} — authentic, alive, cinematic. Not stiff, not staged.`]
      : isEditorial && !isCleanPortrait
        ? [`POSE: ${pickFemaleEditorialPose(input.stylePrompt, isFullBody)} — feel candid, alive, editorial. Not stiff, not staged, not runway.`]
        : []),
    // LIGHTING / ATMOSPHERE:
    ...(isMenCinematic
      ? [buildMenAtmosphere(input.stylePrompt)]
      : isSocialPortrait
        ? [`LIGHTING: ${pickFromArray(LIGHTINGS_SOCIAL)}`]
        : isEditorial && !isBWPortrait
          ? [`LIGHTING: ${pickLighting()}`]
          : []),
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    // [STYLE DIRECTION] — эстетическое направление конкретного стиля из каталога.
    input.stylePrompt ? `Style direction: ${input.stylePrompt}` : '',
    // [USER STYLING NOTE] — пользовательские пожелания, прошедшие backend-фильтр.
    // filteredWish уже очищен от запросов на изменение тела/лица/возраста.
    // IDENTITY_LOCK выше имеет приоритет над этим блоком.
    filteredWish ? `User styling note (accessories/clothing/background/lighting only — body and identity preserved): ${filteredWish}` : '',
    '',
    // ── Глобальный AVOID ──────────────────────────────────────────────────────
    avoidBlock,
  ].filter(Boolean).join('\n');
}

// ── INSTANTID SHORT PROMPT ────────────────────────────────────────────────────
// Для identity-preserving пайплайна (Replicate InstantID / FLUX-PuLID) нужен
// КОРОТКИЙ промпт: SDXL/FLUX text-encoder (CLIP) теряет фокус на длинных текстах,
// а сохранение лица там делает не промпт, а face-embedding. Поэтому здесь — только
// стиль (одежда/фон/свет), переиспользуя те же variety-пулы, что и Gemini-путь.
// Идентичность держит сама модель (controlnet + ip-adapter), не текст.

export interface ShortPortraitPrompt {
  prompt: string;
  negativePrompt: string;
}

export function buildSocialPortraitShortPrompt(genderMode?: 'female' | 'male'): ShortPortraitPrompt {
  const isMale = genderMode === 'male';
  const outfit = pickFromArray(isMale ? WARDROBE_SOCIAL_MALE : WARDROBE_SOCIAL_FEMALE);
  const bg = pickFromArray(BACKGROUNDS_SOCIAL);
  const light = pickFromArray(LIGHTINGS_SOCIAL);
  const subject = isMale ? 'man' : 'woman';

  // Берём только головную часть описаний (до em-dash / "NO ...") — компактно для CLIP.
  const head = (s: string) => s.split(' — ')[0].split(', NO ')[0].split(', no ')[0].trim();

  const prompt = [
    `professional premium social media portrait of a ${subject}`,
    `wearing ${head(outfit)}`,
    head(bg),
    head(light),
    'natural realistic skin texture with real pores',
    'sharp detailed eyes with bright catchlights',
    'soft flattering portrait light, photographic, shot on 85mm lens',
    'keep the exact same face, face shape and age from the reference photo',
  ].join(', ');

  const negativePrompt = [
    'different person', 'face slimming', 'v-shape jaw', 'narrowed face', 'widened face',
    'rounded face', 'younger face', 'model face', 'beauty filter', 'airbrushed',
    'plastic skin', 'over-smoothed skin', 'cartoon', 'illustration', '3d render',
    'deformed face', 'distorted face', 'blurry', 'lipstick on teeth', 'duplicate', 'watermark',
  ].join(', ');

  return { prompt, negativePrompt };
}

// ── EXPERIMENT: social_portrait_identity_test ─────────────────────────────────
// Гипотеза: текущий Gemini-промпт (~3200 слов) глушит фото текстом, и модель
// рисует «по описанию», а не по лицу. Эта функция — минимальный edit-style промпт
// (~70-90 слов, сокращение ~97%). Принципы:
//   1. Фото = главный источник. Текст НЕ переописывает лицо (никаких geometry-локов).
//   2. Edit-логика вместо «replace everything»: "change clothing while keeping
//      the same person", "place the SAME person in a new setting".
//   3. Текст описывает только одежду / локацию / свет / настроение.
//   4. Один короткий identity-якорь, без 14 дублей.
// Включается env-флагом SOCIAL_PORTRAIT_MINIMAL=1 (см. generation.ts) для A/Б теста.
// Свет для минимального промпта — описывает КАЧЕСТВО света, без названий приборов.
// LIGHTINGS_SOCIAL называет оборудование (softbox, beauty-dish), и короткий
// edit-промпт заставляет Gemini рисовать сам прибор в кадре. Здесь — только эффект.
// v10: смягчено к фронтально-обволакивающему свету — убраны боковые/directional
// варианты, дававшие тени в носогубке и под глазами (усталость/возраст). Объём
// сохранён, но без старящих теней.
const LIGHTINGS_MINIMAL: readonly string[] = [
  'soft wrapping daylight with gentle facial depth and subtle catchlights',
  'soft frontal window light, even and clean, gentle natural volume on the face',
  'soft diffused natural light, even and warm, with subtle catchlights in the eyes',
  'gentle warm frontal light with soft even illumination and real facial depth',
  'soft overcast daylight, even and natural, real skin texture',
  'warm soft indoor light, gentle and natural, subtle depth on the face',
];

export function buildSocialPortraitMinimalPrompt(genderMode?: 'female' | 'male'): string {
  const isMale = genderMode === 'male';
  const outfit = pickFromArray(isMale ? WARDROBE_SOCIAL_MALE : WARDROBE_SOCIAL_FEMALE);
  const bg = pickFromArray(BACKGROUNDS_SOCIAL);
  const light = pickFromArray(LIGHTINGS_MINIMAL);
  const head = (s: string) => s.split(' — ')[0].split(', NO ')[0].split(', no ')[0].trim();

  // v9: переработка по приоритетам identity-first (ТЗ владелицы).
  //   P1 IDENTITY LOCK (первым блоком) → P2 geometry → P3 age → P4 hair → P5 outfit/scene.
  //   Удалены glamour/beauty-триггеры: magnetic, allure, magazine presence, radiant,
  //   flattering. Живые глаза + catchlight сохранены (одобрено), улыбка убрана (ломала
  //   нижнюю треть). Голова строго фронтальна (поворот = дрейф). Другие стили не тронуты.
  return [
    // ── PRIORITY 1 — IDENTITY LOCK (до style/outfit/light/background) ──
    `IDENTITY LOCK (absolute priority). Recognizability is more important than beauty. The person in the reference image must remain the same person. Do not beautify. Do not improve attractiveness. Do not make the face slimmer. Do not narrow the jaw. Do not reduce cheek volume. Do not alter facial geometry. Do not alter facial proportions. Do not alter lip shape. Do not alter eye shape. Do not alter eye spacing. Do not alter nose shape. Do not alter apparent age. Do not smooth skin excessively. Keep natural skin texture. Keep natural asymmetry. A less beautiful but more recognizable result is preferred over a more beautiful but less recognizable result. Identity preservation has absolute priority over styling.`,
    // ── PRIORITY 2 — FACIAL GEOMETRY ──
    `Take the exact same ${isMale ? 'man' : 'woman'} from the uploaded photo and copy the face exactly: same face shape and width, same jaw width, same cheek volume, same lower-face width, same chin, same nose shape, same lip shape, same eye shape and eye spacing. Do not slim, widen, round or reshape any part of the face. This is the same real person.`,
    // ── PRIORITY 3 — AGE ──
    `Keep the exact same real age as in the photo — do not rejuvenate, do not remove existing lines, do not add new wrinkles. Healthy natural skin with real pores and real texture — not smoothed, not retouched, not plastic.`,
    // ── PRIORITY 4 — HAIR ──
    `Keep the exact same hairstyle, hair length and hair colour as in the photo.`,
    // ── Композиция (контроль масштаба лица + строго фронтально) ──
    `Tight close-up head-and-shoulders portrait, the face fills a large part of the frame — only head and shoulders, NOT full body, no legs or waist. Face and head fully frontal and straight to the camera — do NOT turn or tilt the head, no 3/4 face, no profile. A little air above the head, face not dead-centred.`,
    // ── Выражение (тёплое, живые глаза, БЕЗ улыбки; negation убран → позитив) ──
    `Expression: calm, warm and approachable, genuine and rested. Mouth naturally relaxed and closed, soft and at ease (no smile, no teeth). Eyes alive, warm and present with a real natural catchlight and an authentic, gently warm gaze into the camera.`,
    // ── PRIORITY 5 — OUTFIT & SCENE (наименьший вес) ──
    `Change only the clothing to: ${head(outfit)}, modest neckline. Place the same person in a new setting: ${head(bg)}. Lighting: ${head(light)}; soft portrait light that gently wraps the face and keeps natural facial volume, with minimal shadow under the eyes and around the nose and mouth — soft and clean, not flat, no studio equipment visible in the frame.`,
    // ── Avoid ──
    `Avoid: beautified face, slimmer face, narrowed jaw, reduced cheeks, rounder face, altered lips, altered eyes, altered eye spacing, altered nose, changed age, younger face, smoothed or plastic skin, retouched skin, model face, glamour, editorial beauty enhancement, smile, teeth, open mouth, turned or tilted head, 3/4 face, profile, full body.`,
  ].join(' ');
}

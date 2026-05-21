// Prompt builder для парных генераций (Phase 5 — Together styles).
//
// Архитектура:
//   buildPairPrompt({ stylePrompt }) собирает полный промпт из блоков:
//     1. identityBlockA  — identity lock для Человека A (reference image 1).
//     2. identityBlockB  — identity lock для Человека B (reference image 2).
//     3. compositionBlock — правила композиции, запрет merge и extra people.
//     4. stylePrompt     — стилевой блок из БД (специфика для каждого стиля).
//     5. negativeBlock   — AVOID-список для pair генераций.
//
// Принцип: IDENTITY > COMPOSITION > STYLE.
// Если реалистичность и style конфликтуют — приоритет у identity.
//
// Не меняет buildPrompt() из prompts.ts — полностью изолирован.

export interface BuildPairPromptInput {
  stylePrompt: string;
}

// ---------------------------------------------------------------------------
// БЛОК A: Identity lock для Person A (первая reference image)
// ---------------------------------------------------------------------------
const identityBlockA = `\
== PERSON A — REFERENCE IMAGE 1 (first photo provided) ==
IDENTITY LOCK — PERSON A:
- The first image (Reference 1) shows Person A. Preserve this identity in full.
- Preserve exact facial geometry of Person A: jaw line, cheekbones, nose bridge and tip,
  eye spacing, forehead shape, chin shape.
- Preserve exact skin tone, hair color, hair texture, hair length of Person A.
- Preserve the exact gender and apparent age of Person A as shown in Reference 1.
- Person A must be instantly recognizable as the exact same person from Reference Image 1.
- Do NOT soften, smooth, or cosmetically alter Person A's facial structure.
- Do NOT reinterpret Person A's face toward a generic beauty standard.
- Do NOT allow Person A's features to drift toward Person B's features in any way.
- Person A's face, hair, and body must match Reference Image 1 — not an idealized version.`;

// ---------------------------------------------------------------------------
// БЛОК B: Identity lock для Person B (вторая reference image)
// ---------------------------------------------------------------------------
const identityBlockB = `\
== PERSON B — REFERENCE IMAGE 2 (second photo provided) ==
IDENTITY LOCK — PERSON B:
- The second image (Reference 2) shows Person B. Preserve this identity in full.
- Preserve exact facial geometry of Person B: jaw line, cheekbones, nose bridge and tip,
  eye spacing, forehead shape, chin shape.
- Preserve exact skin tone, hair color, hair texture, hair length of Person B.
- Preserve the exact gender and apparent age of Person B as shown in Reference 2.
- Person B must be instantly recognizable as the exact same person from Reference Image 2.
- Do NOT soften, smooth, or cosmetically alter Person B's facial structure.
- Do NOT reinterpret Person B's face toward a generic beauty standard.
- Do NOT allow Person B's features to drift toward Person A's features in any way.
- Person B's face, hair, and body must match Reference Image 2 — not an idealized version.`;

// ---------------------------------------------------------------------------
// БЛОК КОМПОЗИЦИИ: правила кадра с двумя людьми
// ---------------------------------------------------------------------------
const compositionBlock = `\
== COMPOSITION RULES ==
- The output photo contains EXACTLY TWO people: Person A and Person B — and no one else.
- No third person, no additional figures, no extra hands, feet, or faces in the background.
- Both Person A and Person B must be clearly visible and recognizable in the frame.
- The two faces must be clearly distinct from each other — different people, not twins.
- No face replacement: Person A keeps Person A's face; Person B keeps Person B's face.
- No identity swap: do not put Person A's face on Person B's body or vice versa.
- No face merging: do not blend or mix facial features between the two subjects.
- Natural body positioning for two people together — not floating, not overlapping unnaturally.
- Both subjects occupy appropriate space in the frame, neither hidden nor cropped awkwardly.`;

// ---------------------------------------------------------------------------
// GAZE & EMOTIONAL ENERGY — прямой взгляд в камеру + эмоциональная искра
// ---------------------------------------------------------------------------
const gazeEnergyBlock = `\
== GAZE & EMOTIONAL ENERGY ==
- BOTH Person A and Person B look DIRECTLY into the camera lens.
- Both pairs of eyes must be clearly visible, open, and in sharp focus.
- Eyes convey genuine positive energy: warmth, joy, confidence, or connection — appropriate to the selected style.
- Authentic natural expression: real smile, genuine calm confidence, or warm emotional presence.
- Expression must not be forced, exaggerated, blank, frozen, or lifeless.
- NO sunglasses.
- NO hair covering eyes.
- NO heavy shadows obscuring eyes.
- NO turned-away faces.
- NO looking at each other instead of camera unless the style explicitly requires it.
- The emotional spark in both pairs of eyes is one of the main subjects of the photo.`;

// ---------------------------------------------------------------------------
// STYLE VARIATION & UNIQUENESS — уникальность каждой генерации
// ---------------------------------------------------------------------------
const variationBlock = `\
== STYLE VARIATION & UNIQUENESS ==
- Do NOT repeat the same location, pose, framing, or body arrangement across generations.
- Each generation must create a fresh interpretation of the selected style.
- Vary the environment, distance, camera angle, background depth, body position, and interaction.
- Keep the same style mood, but change the visual scene and pose logic.
- Avoid default rooftop, default empty street, default shoulder-to-shoulder standing, and default centered symmetrical pose.
- Avoid making every photo look like the same template with different clothes.
- The result must feel like a new premium photoshoot concept, not a duplicate generation.
- Preserve the selected style identity, but make the visual execution unique each time.`;

// ---------------------------------------------------------------------------
// POSE & INTERACTION VARIATION — разнообразие поз и взаимодействий
// ---------------------------------------------------------------------------
const poseVariationBlock = `\
== POSE & INTERACTION VARIATION ==
- Create a natural but intentional pose appropriate to the selected style.
- Vary how Person A and Person B interact: standing close, walking, leaning, seated, slightly angled,
  one slightly behind the other, casual movement, editorial stance, relaxed connection, or confident partnership presence.
- Do NOT always place both people front-facing in the same rigid pose.
- Do NOT always use simple shoulder-to-shoulder composition.
- Maintain clear visibility of both faces and both eyes.
- Both people must remain recognizable as separate individuals.
- No merged bodies, no fused limbs, no duplicated faces, no distorted hands.
- The pose must look like a real professional photoshoot, not a random snapshot or accidental candid.
- The interaction should feel emotionally believable and suitable for the chosen style.`;

// ---------------------------------------------------------------------------
// NEGATIVE PROMPT для парных генераций
// ---------------------------------------------------------------------------
function buildPairNegativePrompt(): string {
  const terms = [
    // Identity integrity
    'face merging', 'face blending', 'identity swap', 'facial feature mixing',
    'face replacement', 'face substitution', 'identity drift', 'face transplant',
    'features from one person applied to another',
    // Extra people / composition errors
    'third person', 'extra person', 'additional person', 'extra figure',
    'additional hands', 'extra faces', 'crowd',
    // Generic AI face problems
    'generic model face', 'AI beauty filter', 'fashion model face',
    'beauty filter', 'skin smoothing', 'facial reconstruction',
    'altered facial proportions', 'editorial face reinterpretation',
    'stylized facial anatomy', 'runway model transformation',
    // Technical quality issues
    'deformed faces', 'distorted features', 'mismatched eye sizes',
    'floating limbs', 'extra limbs', 'blurry faces',
    'merged people', 'fused bodies', 'duplicated face', 'distorted hands', 'broken fingers',
    // Gaze and eye quality
    'blank eyes', 'hidden eyes', 'eyes closed', 'sunglasses', 'hair covering eyes',
    'looking away from camera', 'faces obscured', 'heavy shadows on eyes',
    // Composition repetition
    'repeated identical pose', 'repeated identical location', 'same template composition',
    'default shoulder-to-shoulder pose', 'random snapshot', 'accidental candid photo',
  ];
  return `AVOID: ${terms.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// PRIORITY HEADER — устанавливает иерархию для модели
// ---------------------------------------------------------------------------
const priorityHeader = `\
GENERATION DIRECTIVE: PAIRED PORTRAIT — TWO DISTINCT REAL PEOPLE
PRIORITY ORDER: 1) IDENTITY PRESERVATION  2) COMPOSITION ACCURACY  3) STYLE AESTHETICS
If identity preservation conflicts with style goals — identity wins.
`;

// ---------------------------------------------------------------------------
// buildPairPrompt — главный экспорт
// ---------------------------------------------------------------------------
export function buildPairPrompt(input: BuildPairPromptInput): string {
  const { stylePrompt } = input;

  const parts: string[] = [
    priorityHeader,
    identityBlockA,
    '',
    identityBlockB,
    '',
    compositionBlock,
    '',
    gazeEnergyBlock,
    '',
    variationBlock,
    '',
    poseVariationBlock,
    '',
    stylePrompt.trim(),
    '',
    buildPairNegativePrompt(),
  ];

  return parts.join('\n');
}

export { buildPairNegativePrompt };

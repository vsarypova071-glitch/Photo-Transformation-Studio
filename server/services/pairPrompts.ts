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
    // Style issues specific to pairs
    'sunglasses obscuring faces',
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
    stylePrompt.trim(),
    '',
    buildPairNegativePrompt(),
  ];

  return parts.join('\n');
}

export { buildPairNegativePrompt };

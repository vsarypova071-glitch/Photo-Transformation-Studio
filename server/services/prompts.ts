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

export function buildPrompt(input: BuildPromptInput): string {
  const garment = pickGarment();
  const fullBodyHint = input.isFullBody
    ? 'Full body composition: include subject from head to feet.'
    : 'Portrait composition: head and shoulders, magazine cover style.';

  return `Ultra-photorealistic editorial portrait. Preserve the subject's exact facial identity, geometry of nose, lips, eyes and skin texture from the reference photo (no slimming, no reshaping). Eyes: vivid, with soft catchlights and subtle wet sheen, slight 5° downward gaze for elegance.

${fullBodyHint}
OUTFIT: ${garment}.
${input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : ''}
${input.stylePrompt ? `Style direction: ${input.stylePrompt}` : ''}
${input.customPrompt ? `Additional note: ${input.customPrompt}` : ''}`.trim();
}

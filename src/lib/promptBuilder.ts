const GARMENT_VARIATIONS = [
  "structured tailored blazer",
  "flowing silk couture blouse",
  "architectural high-fashion dress",
  "luxury monochrome power suit",
  "minimalist cashmere ensemble",
  "avant-garde asymmetrical outfit",
  "fine linen Italian tailoring",
  "layered couture styling"
];

function getRandomGarment() {
  return GARMENT_VARIATIONS[
    Math.floor(Math.random() * GARMENT_VARIATIONS.length)
  ];
}

const IDENTITY_LOCK = `
IDENTITY PRESERVATION RULES:
- The uploaded image is the identity reference.
- Maintain the exact facial structure.
- Do not modify nose geometry.
- Do not alter cheekbone structure.
- Keep original jawline shape.
- Preserve eye spacing and eyelid form.
- No beautification.
- No face reshaping.
- Natural skin texture only.
`;

const ULTRA_CLEAN_RULES = `
STRICT OUTPUT RULES:
- No text.
- No letters.
- No typography.
- No logos.
- No branding.
- No magazine layouts.
- No headlines.
- No graphic overlays.
- No watermarks.
- Clean professional photograph only.
`;

const PREMIUM_ENHANCEMENT = `
PREMIUM PRODUCTION QUALITY:
- Cinematic lighting with depth.
- Professional high-fashion posing.
- Micro-detail couture fabric textures.
- Luxury depth of field.
- Ultra realistic skin rendering.
- Advanced shadow modeling.
`;

export function buildPrompt({
  styleKeywords,
  isPremium
}: {
  styleKeywords: string;
  isPremium: boolean;
}) {

  const garment = getRandomGarment();

  return `
You are a world-class luxury fashion photographer.

Create a hyper-realistic high-end fashion portrait.

STYLE:
${styleKeywords}

GARMENT CONSTRUCTION:
${garment}

${IDENTITY_LOCK}

${ULTRA_CLEAN_RULES}

${isPremium ? PREMIUM_ENHANCEMENT : ""}

Camera:
- 85mm or 135mm portrait lens
- RAW photography style
- Professional studio lighting
- High resolution detail
- Strictly photorealistic
`;
}

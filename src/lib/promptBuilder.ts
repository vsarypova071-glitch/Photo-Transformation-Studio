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

const STYLE_LIGHTING_MAP: Record<string, string> = {
  "Quiet Luxury": `
Soft diffused window light.
Warm neutral tones.
Low contrast.
Gentle shadow transitions.
`,

  "New York Power": `
High contrast directional lighting.
Sharper shadows.
Urban reflective highlights.
Cool undertones.
`,

  "Golden Hour Glow": `
Warm backlighting.
Golden rim light.
Soft flare diffusion.
Sunset atmosphere.
`,

  "Luxury Editorial": `
Dramatic sculpted lighting.
Hard key light.
Deep shadows.
Museum-like contrast.
`
};

const STYLE_BACKGROUND_MAP: Record<string, string> = {
  "Quiet Luxury": `
Luxury penthouse interior.
Soft natural daylight.
Textured stone, warm wood, neutral palette.
Minimalistic but expensive environment.
`,

  "New York Power": `
Modern skyscraper interior.
Glass reflections.
City lights in background.
Urban night atmosphere.
`,

  "Golden Hour Glow": `
Rooftop at sunset.
Soft skyline horizon.
Warm atmosphere.
Natural depth perspective.
`,

  "Luxury Editorial": `
Minimalist art museum space.
Architectural concrete textures.
Clean geometry.
High-fashion campaign setting.
`
};

export function buildPrompt({
  styleKeywords,
  isPremium
}: {
  styleKeywords: string;
  isPremium: boolean;
}) {

  const garment = getRandomGarment();

  const styleLighting =
    STYLE_LIGHTING_MAP[styleKeywords] ??
    "High-end editorial studio lighting.";

  const styleBackground =
    STYLE_BACKGROUND_MAP[styleKeywords] ??
    "Luxury neutral studio background.";

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

LIGHTING ARCHITECTURE:
${styleLighting}
Directional sculpted key light with controlled falloff.
Subject-background separation.
Balanced highlight roll-off.
No flat lighting.
No harsh flash.
No blown highlights.
Natural skin tonality.
No oversharpening.
No plastic glow.

BACKGROUND ARCHITECTURE:
${styleBackground}
No artificial CGI look.
Real physical environment.
Proper light interaction with surroundings.

TEXTILE & MATERIAL REALISM:
Luxury couture construction.
Structured silhouette with dimensional tailoring.
Visible micro-fabric texture.
Natural fabric behavior (weight, folds, gravity).
Premium materials only (cashmere, silk, fine wool, structured satin).
No synthetic shine.
No fast-fashion appearance.

DEPTH & SPATIAL QUALITY:
Cinematic depth of field.
Foreground/background separation.
Subtle background blur.
Realistic environmental light interaction.
High dynamic range rendering.
Natural color grading.
Three-dimensional realism.

PRODUCTION LEVEL:
Luxury campaign aesthetic.
Editorial magazine quality.
Confident, high-status posture.
Natural but powerful presence.
Ultra clean composition.
No artificial AI gloss.

Camera:
- 85mm or 135mm portrait lens
- RAW photography style
- Professional studio lighting
- High resolution detail
- Strictly photorealistic
`;
}


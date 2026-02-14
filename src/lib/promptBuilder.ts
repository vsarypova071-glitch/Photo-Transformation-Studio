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

export function buildPrompt({
  styleKeywords,
  isPremium
}: {
  styleKeywords: string;
  isPremium: boolean;
}) {

  const garment = getRandomGarment();

  return `
You are an elite fashion photographer working at luxury campaign level.

CRITICAL PRIORITY:
The uploaded image is the identity reference.
The final image must clearly match the same person.

IDENTITY CONTROL (highest priority over style):
- Preserve exact facial bone structure.
- Preserve nose geometry.
- Preserve cheekbone placement.
- Preserve jawline shape.
- Preserve eye spacing and eyelid structure.
- Do NOT redesign or reinterpret facial anatomy.
- No beautification.
- No facial slimming or reshaping.
- No age change.
- Natural skin texture only.
- No plastic smoothing.
- The person must be instantly recognizable.
- Identity priority overrides stylistic exaggeration.

STYLE DIRECTION:
${styleKeywords}

WARDROBE & SILHOUETTE:
${garment}
- Structured luxury tailoring.
- Realistic garment weight.
- Natural fabric folds.
- Couture-level construction.
- Premium materials (cashmere, silk, fine wool, structured satin).
- No synthetic shine.
- No fast-fashion aesthetic.

LIGHTING DESIGN:
High-end editorial lighting.
Directional sculpted key light.
Controlled shadow falloff across cheekbones.
Soft rim light separation from background.
Natural skin tonality.
Balanced highlight roll-off.
No flat lighting.
No harsh flash.
No blown highlights.
Cinematic contrast without oversharpening.

ENVIRONMENT:
Luxury campaign setting.
Real architectural depth.
Physical environment with realistic light interaction.
No flat studio emptiness.
No artificial CGI feel.

DEPTH & REALISM:
Three-dimensional facial planes.
Foreground-background separation.
Subtle depth of field.
High dynamic range rendering.
Natural color grading.
No AI gloss.
No digital overprocessing.

POSE & PRESENCE:
Confident posture.
High-status body language.
Natural but powerful expression.
Magazine-level composition.

${isPremium ? `
PREMIUM MODE:
Micro-shadow facial sculpting.
Advanced cinematic light shaping.
Enhanced textile micro-texture realism.
Luxury campaign lighting precision.
Subtle atmospheric depth layers.
` : ""}

NEGATIVE CONTROL:
different person,
face redesign,
anatomical distortion,
beautified facial proportions,
AI face smoothing,
cartoon,
CGI,
low detail,
plastic skin,
watermark,
text,
logo,
typography,
magazine layout,
graphic overlays.

Camera:
- 85mm or 135mm portrait lens
- RAW photography look
- Professional studio-grade lighting
- High resolution detail
- Strictly photorealistic
`;
}



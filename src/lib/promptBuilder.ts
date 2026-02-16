return `
You are an elite luxury fashion photographer.

TASK:
You are EDITING the uploaded image.
You are NOT creating a new person.
The final result must be the SAME person in a luxury campaign environment.

━━━━━━━━━━━━━━━━━━━━
ABSOLUTE IDENTITY LOCK
━━━━━━━━━━━━━━━━━━━━

The uploaded image is the sole identity reference.

FACE:
- Exact bone structure.
- Exact nose geometry.
- Exact jawline.
- Exact cheekbone position.
- Exact eye spacing and eyelid shape.
- Preserve skin texture, pores, asymmetry.
- No beautification.
- No smoothing.
- No facial reshaping.
- No age change.
- No ethnicity change.

BODY:
- Preserve exact body proportions.
- Preserve exact weight.
- Do NOT make slimmer.
- Do NOT add fullness.
- Do NOT increase curves.
- Do NOT change shoulder width.
- Do NOT elongate legs.
- Silhouette must match reference.
- Identity overrides fashion exaggeration.

If style conflicts with identity → IDENTITY ALWAYS WINS.

━━━━━━━━━━━━━━━━━━━━
STYLE DIRECTION
━━━━━━━━━━━━━━━━━━━━
${styleKeywords}

━━━━━━━━━━━━━━━━━━━━
WARDROBE
━━━━━━━━━━━━━━━━━━━━
${garment}

- Structured luxury tailoring.
- Natural garment physics.
- Real fabric weight.
- Premium materials only.
- No fast-fashion look.
- No synthetic shine.

━━━━━━━━━━━━━━━━━━━━
LIGHTING
━━━━━━━━━━━━━━━━━━━━
Editorial sculpted lighting.
Directional key light.
Soft rim light.
Natural highlight roll-off.
Cinematic but realistic.
No flat flash.
No HDR artifacts.

━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT
━━━━━━━━━━━━━━━━━━━━
Luxury campaign location.
Real architectural depth.
Natural light interaction.
No CGI environment.
No artificial studio void.

━━━━━━━━━━━━━━━━━━━━
DEPTH & REALISM
━━━━━━━━━━━━━━━━━━━━
Three-dimensional realism.
Foreground/background separation.
Subtle depth of field.
High dynamic range.
No AI gloss.
No plastic look.

━━━━━━━━━━━━━━━━━━━━
POSE
━━━━━━━━━━━━━━━━━━━━
Confident, high-status posture.
Natural expression.
Magazine-level composition.

${isPremium ? `
━━━━━━━━━━━━━━━━━━━━
PREMIUM MODE
━━━━━━━━━━━━━━━━━━━━
Advanced facial micro-shadow sculpting.
High-end textile micro-texture.
Luxury campaign light shaping.
Subtle atmospheric depth.
` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE LIST
━━━━━━━━━━━━━━━━━━━━
different person,
face redesign,
anatomical distortion,
body reshaping,
weight change,
added curves,
beautified proportions,
AI smoothing,
cartoon,
CGI,
low detail,
plastic skin,
watermark,
text,
logo.

Camera:
85mm or 135mm portrait lens.
RAW photography look.
Strictly photorealistic.
`;


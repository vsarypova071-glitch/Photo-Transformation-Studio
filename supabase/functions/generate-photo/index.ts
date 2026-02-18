function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are performing a PROFESSIONAL IMAGE EDIT, not full regeneration.

━━━━━━━━━━━━━━━━━━━━
PRIORITY HIERARCHY
━━━━━━━━━━━━━━━━━━━━
1. Identity preservation (absolute)
2. Body preservation
3. Clothing adaptation
4. Environment styling

If conflict occurs — always keep identity unchanged.

━━━━━━━━━━━━━━━━━━━━
IDENTITY LOCK
━━━━━━━━━━━━━━━━━━━━

The uploaded image is the BASE.
Keep the exact same person.

FACE:
• Preserve exact skull structure and facial geometry.
• Preserve exact jawline, chin length, cheekbones.
• Preserve eye spacing, eyelid shape, iris color.
• Preserve nose structure and nostrils.
• Preserve lip proportions.
• Preserve natural asymmetry.
• Preserve skin texture (no smoothing).
• Same age. Same ethnicity.

Do NOT:
- reconstruct the face
- idealize proportions
- alter bone structure
- change expression geometry
- relight the face differently from original

The face must look like the original photo placed in a new scene.

━━━━━━━━━━━━━━━━━━━━
HAIR
━━━━━━━━━━━━━━━━━━━━
• Same length.
• Same hairline.
• Same texture.
• No extra volume.
• No length change.

━━━━━━━━━━━━━━━━━━━━
BODY
━━━━━━━━━━━━━━━━━━━━
• Preserve exact bust size.
• Preserve exact waist and hips.
• No body enhancement.
• No slimming.
• No reshaping.
• Clothing must fit the real body.
• The body must NOT adapt to fashion proportions.

━━━━━━━━━━━━━━━━━━━━
CLOTHING — CUSTOM TAILORING
━━━━━━━━━━━━━━━━━━━━
Luxury made-to-measure tailoring.
Garment is individually adjusted to the real body.
Premium fabrics (cashmere, silk, fine wool).
Modern 2026 elegance.
No costume effect.
No exaggerated fashion proportions.

Wardrobe example:
${garment}

━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT & QUALITY
━━━━━━━━━━━━━━━━━━━━
High-end editorial photography.
Natural depth of field.
Professional optical rendering.
Refined cinematic light without altering facial structure.
Realistic fabric texture.
Natural eye catchlight.
No artificial glow.
No plastic skin.

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Custom direction: ${customPrompt}` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE
━━━━━━━━━━━━━━━━━━━━
different person,
face regeneration,
body reshaping,
bust enlargement,
waist slimming,
AI beautification,
plastic skin,
symmetry correction,
cartoon,
CGI,
illustration,
low quality.

OUTPUT:
One ultra-realistic luxury fashion photograph.
Identity must remain intact.`;
}

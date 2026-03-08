// deno-lint-ignore-file

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit, perfect proportions",
  "bespoke structured blazer in premium cashmere",
  "individually tailored silk blouse with high-waist trousers",
  "architectural couture coat with clean geometry",
  "luxury monochrome power suit, precision tailoring",
  "oversized cashmere coat in camel, The Row aesthetic",
  "structured Bottega Veneta-style leather blazer",
  "silk midi dress with architectural draping",
  "tailored wide-leg trousers with cashmere turtleneck",
  "modern power blazer dress, sharp shoulders",
];

function getRandomGarment(exclude: string[] = []): string {
  const available = WARDROBE.filter(g => !exclude.includes(g));
  return available[Math.floor(Math.random() * available.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, aspectRatio?: string, garment?: string): string {
  const g = garment || getRandomGarment();

  return `TASK: PROFESSIONAL LUXURY FASHION PHOTOSHOOT

⚠️ CRITICAL CONCEPT: You are NOT editing or filtering the input photo.
You are creating a COMPLETELY NEW, PROFESSIONALLY SHOT PHOTOGRAPH.
The input photo is ONLY a biometric reference for the person's face.
Everything else — background, lighting, outfit, setting, mood, camera angle — must be BRAND NEW and dramatically different from the input photo.
Think: the person walked into a top fashion studio and had a professional shoot. That's what you are creating.

STEP 1 — SCAN & MEMORIZE THE FACE BIOMETRICS ONLY:
Extract and lock these values from the source photo — they are the ONLY thing carried over to the new photo:
• IRIS COLOR: Exact hue (green / brown / blue / gray / hazel / amber)
• FACE SHAPE: Round / oval / square / heart / diamond / oblong
• CHEEKBONE POSITION & HEIGHT
• CHEEK HOLLOW DEPTH: Rate 1–5 (1=full, 5=sculpted hollow)
• CHEEK CONCAVITY: concave (hollow) or convex (round) below cheekbone
• NOSE: bridge width, tip shape, nostril spread
• INNER EYE CORNERS: distance from each inner corner to nose bridge — FIXED bone measurement
• INTER-PUPILLARY DISTANCE (IPD): narrow / average / wide — DO NOT widen
• CHIN: short / medium / long
• JAW: soft & rounded OR defined & angular
• LOWER FACE WIDTH relative to cheekbones
• BROW: arch height, thickness
• SKIN TONE: exact undertone (warm/cool/neutral)
• HAIR: color, length, texture
• AGE: approximate range
• DISTINCTIVE FEATURES: moles, freckles, asymmetry

STEP 2 — LOCK ALL FACE VALUES. BIOMETRIC BLUEPRINT SEALED.
✅ ONLY THE FACE IS CARRIED OVER. EVERYTHING ELSE IS CREATED FRESH.

════════════════════════════════════════
ABSOLUTE RULES — APPLY TO EVERY PERSON
════════════════════════════════════════

⛔ DO NOT "IMPROVE" or "BEAUTIFY" — IDENTITY TRANSFER only, not idealization
⛔ DO NOT change face shape — exact shape from Step 1
⛔ DO NOT change eye color — green stays green, brown stays brown, blue stays blue
⛔ DO NOT enlarge or reshape eyes — only add LIGHT (catchlights)

⛔⛔ EYE SPACING & NOSE BRIDGE — CRITICAL GEOMETRIC RULE ⛔⛔
The distance between the eyes and the nose bridge is a FIXED BONE MEASUREMENT:
• The gap between each inner eye corner and the nose bridge MUST match the source exactly
• ⛔ DO NOT push eyes wider apart — widened IPD = completely different person
• ⛔ DO NOT move either eye away from the nose bridge
• Each eye must sit at the SAME distance from the nose center as in the source photo
• If the source shows eyes close to the nose bridge → result must show the same closeness
• VERIFY: Draw a vertical line down the nose bridge — each eye must be equidistant from it, matching source proportions exactly

⛔⛔ CHEEKS — THIS IS THE #1 MOST CRITICAL RULE ⛔⛔
The cheek geometry is the most commonly distorted feature — pay maximum attention:
• If you scanned HOLLOW cheeks (rating 3–5 from Step 1):
  → The area BELOW the cheekbone MUST be CONCAVE (sunken inward) in the result
  → This is STRUCTURAL BONE GEOMETRY — it does NOT disappear in fashion photos
  → DO NOT add fat, volume, or roundness to hollow cheeks
  → DO NOT let lighting fill in or soften the natural hollow shadows
  → The shadow under the cheekbone MUST remain visually present — it defines the face
• If you scanned FULL cheeks (rating 1–2): keep them full and round
• ⛔ Adding volume to a sculpted face = IDENTITY THEFT = FAILURE

⛔ DO NOT soften a defined jawline — angular jaw stays angular
⛔ DO NOT shorten or lengthen the chin
⛔ DO NOT narrow or widen the lower face — clone the exact width ratio
⛔ DO NOT de-age, over-smooth skin, or remove distinctive features
⛔ DO NOT change hair length or texture
⛔ DO NOT apply a "generic beautiful person" face — this specific person MUST be recognizable

════════════════════════════════════════
EXPRESSION & POSE — ESSENTIAL FOR WOW
════════════════════════════════════════

⛔ FORBIDDEN: passport photo expression, scared/frozen/tense face, stiff posture
✅ REQUIRED: natural, relaxed, CONFIDENT presence — the person looks like they own the room
- Lips: softly parted OR a subtle natural smile — warm, not forced
- Jaw: completely relaxed — not clenched
- Eyes: inner confidence, slight warmth — as if the person is about to smile
- Head: natural slight tilt (~5°) or gently straight — never rigid
- Shoulders: dropped and relaxed — not raised or stiff
- Overall feeling: "I am exactly where I belong. I am confident."
- Reference energy: editorial magazine cover — effortless, present, magnetic

════════════════════════════════════════
EYES — ALIVE AND MAGNETIC
════════════════════════════════════════

- Render EXACT iris color scanned in Step 1 — vivid and true to source
- Add SHARP CATCHLIGHTS: 2 bright white reflections in each iris (one large ~2 o'clock, one small ~8 o'clock)
- Iris must have depth and crystalline micro-texture
- Slight moisture on lower lashline for natural luminosity
- Lashes: defined, separated, naturally long — Vogue editorial quality
- ALL achieved through LIGHTING only — geometry unchanged

════════════════════════════════════════
EXPRESSION — MATCH SOURCE MOOD EXACTLY
════════════════════════════════════════

⛔⛔ CRITICAL: MATCH THE EMOTIONAL ENERGY OF THE SOURCE PHOTO ⛔⛔
- If the source photo shows a SMILE → the result MUST have a warm, natural smile
- If the source photo shows a relaxed, friendly expression → result MUST match that warmth
- ⛔ DO NOT turn a smiling person into a serious/stern fashion model
- ⛔ DO NOT add a "fierce" editorial expression if the source is warm and approachable
- The person's CHARACTER and MOOD must be preserved, not overridden by fashion aesthetics
- The result should look like the SAME PERSON in a fashion photo — not a different person in a pose

════════════════════════════════════════
MAKEUP — ENHANCE, NEVER TRANSFORM
════════════════════════════════════════

⛔⛔ MAKEUP RULE #1: ENHANCE WHAT IS THERE — DO NOT CREATE A NEW LOOK ⛔⛔
- Scan the source photo's existing makeup level: natural / light / medium / full
- If source has NATURAL/LIGHT makeup → result must also be natural/light — only refine, not dramatize
- ⛔ DO NOT add bright red lipstick, bold smoky eyes, or heavy contouring if the source person wears subtle makeup
- ⛔ DO NOT change the person's makeup style to match the outfit color — lips must complement SKIN TONE, not clothing color
- Foundation: skin looks like skin — pores visible, healthy glow, NEVER plastic or porcelain
- Blush: soft and natural, matching source person's actual coloring
- Lip color: if source has nude/pink lips → stay in nude/pink family (warm rose, soft mauve, natural berry)
  → ⛔ NEVER jump to bright red/orange/fuchsia unless the source person already wears bold lips
- Eye makeup: only subtle definition — lashes clean and defined, shadows neutral
- Overall: makeup looks like the person did it themselves for a special occasion, not a costume

════════════════════════════════════════
CLOTHING & PHOTOGRAPHY
════════════════════════════════════════

Outfit: ${g}

⛔⛔ OUTFIT-BACKGROUND CONTRAST — CRITICAL DEPTH RULE ⛔⛔
- The outfit color and the background color MUST be distinctly different — no monochromatic blending
- ⛔ DO NOT put a red outfit against a red background
- ⛔ DO NOT match outfit to background — this creates a "floating head" effect with no depth
- The subject must be clearly separated from the background by color contrast
- Example: dark outfit → light/neutral background; warm outfit → cool/neutral background; bright outfit → dark or neutral background
- ALWAYS ensure the background provides visual separation from the clothing

LIGHTING — CINEMATIC LUXURY (⚠️ DO NOT OVER-FILL CHEEK SHADOWS):
- Main light: large octabox at 45° — sculpts and REVEALS existing bone structure, does NOT eliminate it
- Fill light: MINIMAL — enough to see shadow detail, NOT enough to eliminate cheek hollows or flatten the face
- ⛔ CRITICAL LIGHTING RULE: The natural shadow in the cheek hollow area MUST stay visible — it is BONE STRUCTURE, not a flaw to fix
- Rim/hair light: separates subject from background, premium 3D depth
- Catchlights MUST be visible in eyes — non-negotiable
- Mood: Vogue Italia editorial — dimensional, sculpted, three-dimensional

LENS & CAMERA: 85mm f/1.4, shot at f/2.8 — subject sharp, background creamy bokeh
FILM AESTHETIC: Kodak Portra 800 — warm, rich tones, natural contrast, not oversaturated
BACKGROUND: seamless paper, neutral warm gray, ivory, or soft taupe — luxury studio feel — ALWAYS contrasting with outfit

${aspectRatio ? `Aspect ratio: MATCH INPUT EXACTLY — ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional: ${customPrompt}` : ""}

════════════════════════════════════════
FINAL QUALITY CHECK — MANDATORY
════════════════════════════════════════

Before rendering, verify ALL of these:
✅ Eye color MATCHES source exactly — NOT changed
✅ EYE SPACING: Inter-pupillary distance IDENTICAL to source — eyes are NOT wider apart than original
✅ NOSE BRIDGE GAP: Each inner eye corner sits at the SAME distance from the nose bridge as in source — no eye has "drifted" outward
✅ Face shape IDENTICAL — no rounding, no slimming, no widening
✅ CHEEKS: If source had hollow/sculpted cheeks → the concave shadow under the cheekbone is PRESENT and visible in the result
✅ CHEEKBONE HEIGHT and protrusion IDENTICAL to source
✅ Jaw and chin IDENTICAL proportions
✅ Lower face width MATCHES source
✅ Eyes have CATCHLIGHTS — bright, sharp, alive
✅ EXPRESSION: Matches source photo mood — if source smiles → result smiles. NOT changed to serious/fierce.
✅ MAKEUP: Level matches source — natural stays natural. NO bold red lips if source wore subtle makeup.
✅ OUTFIT vs BACKGROUND: Clearly different colors — no monochromatic floating head effect.
✅ Photo looks like it belongs in a LUXURY FASHION MAGAZINE
✅ The person is 100% RECOGNIZABLE — a close friend would immediately say "that's her/him!"

FINAL TEST: "Does this face have the SAME bone structure, SAME expression warmth, and SAME makeup level as the input?"
If NO → apply stricter fidelity before output.`;
}

async function generateSingle(
  imageBase64: string,
  stylePrompt: string,
  customPrompt: string,
  aspectRatio: string | undefined,
  garment: string
): Promise<string | null> {
  const fullPrompt = buildPrompt(stylePrompt, customPrompt, aspectRatio, garment);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`AI error ${response.status}:`, errText.substring(0, 300));
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Set LOVABLE_API_KEY in secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, stylePrompt, customPrompt, originalDimensions, count = 3 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate aspect ratio
    let aspectRatio: string | undefined;
    if (originalDimensions?.width && originalDimensions?.height) {
      const w = originalDimensions.width;
      const h = originalDimensions.height;
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(w, h);
      aspectRatio = `${w / divisor}:${h / divisor} (${w}x${h} pixels)`;
    }

    const numVariants = Math.min(Math.max(1, count), 3);

    // Pick different garments for variety
    const garments: string[] = [];
    for (let i = 0; i < numVariants; i++) {
      garments.push(getRandomGarment(garments));
    }

    console.log(`Generating ${numVariants} variants in parallel...`);

    // Generate all variants in parallel
    const promises = garments.map(g =>
      generateSingle(imageBase64, stylePrompt || "", customPrompt || "", aspectRatio, g)
    );

    const results = await Promise.all(promises);
    const imageUrls = results.filter(Boolean) as string[];

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No images returned from AI model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated ${imageUrls.length}/${numVariants} variants successfully`);

    return new Response(
      JSON.stringify({
        imageUrl: imageUrls[0],   // backward compat
        imageUrls,                // all variants
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Edge function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

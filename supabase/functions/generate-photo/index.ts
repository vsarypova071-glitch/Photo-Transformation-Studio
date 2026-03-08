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
FACE BIOMETRIC RULES — ONLY THESE ARE PRESERVED
════════════════════════════════════════

⛔ DO NOT change face shape — exact shape from Step 1
⛔ DO NOT change eye color — green stays green, brown stays brown, blue stays blue
⛔ DO NOT enlarge or reshape eyes — only add LIGHT (catchlights)
⛔ DO NOT de-age, over-smooth skin, or remove distinctive features
⛔ DO NOT apply a "generic beautiful person" face — this specific person MUST be recognizable

⛔⛔ EYE SPACING & NOSE BRIDGE — FIXED BONE GEOMETRY ⛔⛔
• The gap between each inner eye corner and the nose bridge MUST match the source exactly
• ⛔ DO NOT push eyes wider apart — widened IPD = completely different person
• Each eye must sit at the SAME distance from the nose center as in the source photo
• VERIFY: Draw a vertical line down the nose bridge — each eye must be equidistant from it

⛔⛔ CHEEKS — MOST CRITICAL RULE ⛔⛔
• If you scanned HOLLOW cheeks (rating 3–5):
  → The area BELOW the cheekbone MUST be CONCAVE (sunken inward)
  → DO NOT add fat, volume, or roundness to hollow cheeks
  → Shadow under the cheekbone MUST remain visually present
• If you scanned FULL cheeks (rating 1–2): keep them full
• ⛔ Adding volume to a sculpted face = IDENTITY THEFT = FAILURE

⛔ DO NOT soften a defined jawline
⛔ DO NOT change jaw width or chin length
⛔ DO NOT change hair length or texture — same cut and color

════════════════════════════════════════
TRANSFORM EVERYTHING ELSE — THIS IS A PHOTOSHOOT
════════════════════════════════════════

✅ NEW SCENE: Create a completely new professional photography setting — NOT similar to the input photo
✅ NEW LIGHTING: Professional studio lighting — octabox, rim light, dramatic shadows (NOT casual window light)
✅ NEW POSE: Confident editorial pose — different from input photo pose
✅ NEW CAMERA ANGLE: Choose the most flattering angle for this face — 3/4 turn, straight, slight down-tilt
✅ NEW EXPRESSION: Choose the most CONFIDENT and FLATTERING expression — editorial magazine energy
   - NOT a copy of whatever the person was doing in their selfie
   - Choose from: powerful direct gaze, slight confident smile, serene composure, magnetic presence
   - The goal: the person should look more powerful and beautiful than in their selfie
✅ NEW BACKGROUND: Dramatic luxury setting — NOT whatever was behind them in the input photo

════════════════════════════════════════
EYES — ALIVE AND MAGNETIC
════════════════════════════════════════

- Render EXACT iris color scanned in Step 1 — vivid and true to source
- Add SHARP CATCHLIGHTS: 2 bright white reflections in each iris (one large ~2 o'clock, one small ~8 o'clock)
- Iris must have depth and crystalline micro-texture
- Slight moisture on lower lashline for natural luminosity
- Lashes: defined, separated, naturally long — Vogue editorial quality

════════════════════════════════════════
MAKEUP — ELEVATED EDITORIAL
════════════════════════════════════════

- Foundation: skin looks like skin — pores visible, healthy glow, NEVER plastic
- Blush: warm, placed high on cheekbones
- Lip color: choose the most flattering shade for this person's skin tone — nude-rose / warm mauve / berry / terracotta
  → ⛔ DO NOT match lip color to outfit color
  → ⛔ DO NOT add bright red lipstick if the person's natural skin tone doesn't suit it
- Contouring: subtle — enhances existing bone structure, does NOT add fake structure
- Eye makeup: clean definition — complements eye color, does NOT change eye shape
- Overall: looks like a professional makeup artist did it for a Vogue shoot

════════════════════════════════════════
CLOTHING & PHOTOGRAPHY
════════════════════════════════════════

Outfit: ${g}

⛔⛔ OUTFIT-BACKGROUND CONTRAST — MANDATORY ⛔⛔
- Outfit color and background color MUST be distinctly different — no monochromatic blending
- ⛔ DO NOT put a red outfit against a red background
- Subject must be clearly separated from background by color contrast
- Dark outfit → light/neutral background; warm outfit → cool/neutral background

LIGHTING — CINEMATIC LUXURY (⚠️ DO NOT FILL IN CHEEK SHADOWS):
- Main light: large octabox at 45° — sculpts and REVEALS bone structure, does NOT flatten it
- Fill light: MINIMAL — cheek hollows must remain visible
- Rim/hair light: separates subject from background, premium 3D depth
- Catchlights in eyes: mandatory
- Mood: Vogue Italia — dimensional, sculpted, three-dimensional

LENS: 85mm f/1.4 at f/2.8 — subject sharp, background creamy bokeh
FILM LOOK: Kodak Portra 800 — warm, rich tones, natural contrast
BACKGROUND: luxury studio — neutral warm gray, ivory, or soft taupe — always contrasting with outfit

${aspectRatio ? `Aspect ratio: MATCH INPUT EXACTLY — ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional: ${customPrompt}` : ""}

════════════════════════════════════════
FINAL QUALITY CHECK — MANDATORY
════════════════════════════════════════

Before rendering, verify ALL of these:
✅ This looks like a PROFESSIONAL PHOTOSHOOT — NOT a filtered version of the input selfie
✅ The setting, lighting, and pose are COMPLETELY DIFFERENT from the input photo
✅ Eye color MATCHES source exactly
✅ EYE SPACING: Inter-pupillary distance IDENTICAL to source — eyes NOT wider apart
✅ NOSE BRIDGE GAP: Each inner eye corner at the SAME distance from nose bridge as in source
✅ Face shape IDENTICAL — no rounding, no slimming, no widening
✅ CHEEKS: hollow cheeks → concave shadow PRESENT; full cheeks → kept full
✅ Jaw and chin IDENTICAL proportions
✅ Hair: same cut and color as source
✅ Eyes have CATCHLIGHTS — bright, sharp, alive
✅ MAKEUP: flattering for this skin tone — NOT matching outfit color
✅ OUTFIT vs BACKGROUND: clearly different colors
✅ Photo belongs in a LUXURY FASHION MAGAZINE
✅ The person is 100% RECOGNIZABLE as the same person from the input photo

FINAL TEST: "Is this a brand new professional fashion photograph of the same person — NOT a copy/edit of the input photo?"
If NO → recreate with proper photoshoot transformation.`;
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

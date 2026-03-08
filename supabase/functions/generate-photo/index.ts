// deno-lint-ignore-file

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit in deep navy, perfect proportions",
  "bespoke structured blazer in forest green premium cashmere",
  "individually tailored silk blouse in ivory with high-waist charcoal trousers",
  "architectural couture coat in camel with clean geometry",
  "luxury monochrome power suit in slate gray, precision tailoring",
  "oversized cashmere coat in off-white, The Row aesthetic",
  "structured leather blazer in cognac brown, Bottega Veneta-style",
  "silk midi dress with architectural draping in deep burgundy",
  "tailored wide-leg trousers in charcoal with ivory cashmere turtleneck",
  "modern power blazer dress in midnight blue, sharp structured shoulders",
];

function getRandomGarment(exclude: string[] = []): string {
  const available = WARDROBE.filter(g => !exclude.includes(g));
  return available[Math.floor(Math.random() * available.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, aspectRatio?: string, garment?: string): string {
  const g = garment || getRandomGarment();

  return `YOU ARE A WORLD-CLASS PORTRAIT PHOTOGRAPHER AND RETOUCHER.
YOUR SINGLE MOST IMPORTANT JOB: The person in the output MUST be 100% recognizable as the EXACT SAME PERSON from the input photo. If someone who knows this person in real life cannot immediately recognize them — you have FAILED.

══════════════════════════════════════════════════════
PHASE 1 — FORENSIC FACE ANALYSIS (read the source photo like a passport officer)
══════════════════════════════════════════════════════

Examine the input photo and record the EXACT measurements internally:

EYES:
• Iris color: precise hue (e.g. "sage green with brown limbal ring", NOT just "green")
• Eye shape: almond / round / hooded / deep-set / wide-set / close-set
• Inter-pupillary distance (IPD): narrow / average / wide — this is BONE STRUCTURE, cannot change
• Distance from each inner eye corner to nose bridge — EXACT, FIXED
• Natural lash density: sparse / medium / full (DO NOT add heavy theatrical lashes)

NOSE:
• Bridge width: narrow / medium / wide
• Tip shape: pointed / rounded / bulbous / upturned
• Nostril spread: narrow / medium / wide

FACE STRUCTURE:
• Face shape: oval / round / square / heart / diamond / oblong
• Cheekbone prominence: flat / medium / high
• Cheek fullness BELOW cheekbone: concave/hollow (3–5) OR convex/full (1–2)
• Jaw: soft & rounded OR defined & angular
• Chin: short / medium / long, pointed / square / rounded

SKIN & AGE:
• Skin tone: exact undertone (warm ivory / cool beige / neutral / olive / etc.)
• Approximate age: reproduce EXACTLY — do NOT de-age, do NOT add years
• Distinctive marks: moles, freckles, asymmetry — ALL must be reproduced

LIPS:
• Natural lip shape: thin / medium / full; bow shape; natural pigment color
• DO NOT change lip shape or add volume

HAIR:
• Exact color and exact cut/texture — DO NOT change hairstyle whatsoever

══════════════════════════════════════════════════════
PHASE 2 — ABSOLUTE BIOMETRIC LOCK — THESE CANNOT CHANGE
══════════════════════════════════════════════════════

⛔ Eye color — not one shade different
⛔ Eye spacing (IPD) — bone structure, cannot be widened or narrowed
⛔ Nose shape — bridge, tip, nostrils exactly as scanned
⛔ Face shape — no slimming, no widening, no restructuring
⛔ Cheek volume — hollow cheeks STAY hollow; full cheeks STAY full
⛔ Jaw definition — do NOT soften a sharp jaw, do NOT sharpen a soft jaw
⛔ Chin proportions — height and shape identical
⛔ Lip shape — natural shape preserved, NO filler effect
⛔ Age — same age as in source photo
⛔ Hair — same cut, color, texture
⛔ Skin tone — same undertone
⛔ Distinctive marks — moles/freckles reproduced

⛔ DO NOT "beautify" this person — they are beautiful AS THEY ARE
⛔ DO NOT apply a generic "beautiful model" face — this is a SPECIFIC REAL HUMAN BEING
⛔ DO NOT add heavy false lashes if source shows natural lashes
⛔ DO NOT smooth skin into plastic perfection — keep natural texture and pores

══════════════════════════════════════════════════════
PHASE 3 — CREATE A NEW PROFESSIONAL PHOTOSHOOT
══════════════════════════════════════════════════════

The input is just a selfie. You are creating a BRAND NEW photograph as if taken in a top fashion studio.
The face (biometrics from Phase 1) is the ONLY connection to the source. Everything else is completely new:

✅ NEW PROFESSIONAL SETTING: luxury studio editorial environment — completely different from the input
✅ NEW LIGHTING: 85mm f/1.4, large octabox at 45° with rim light — cinematic, dimensional, sculpted
✅ NEW POSE: confident editorial pose — hand position, body angle, head tilt all fresh
✅ NEW BACKGROUND: luxury neutral — warm gray / ivory / slate / champagne — NEVER matching the outfit
✅ EXPRESSION: determined, composed, magnetic — the most powerful version of this specific person

OUTFIT: ${g}

⛔ CRITICAL COLOR RULE: Outfit and background MUST be completely different colors
   → Dark outfit → light neutral background
   → Warm-toned outfit → cool/neutral background  
   → ⛔ NEVER: same color family for outfit AND background

MAKEUP — ELEVATED BUT NATURAL:
• Foundation: skin looks like REAL SKIN — natural texture, healthy glow, NOT plastic
• Lips: most flattering shade for THIS person's skin tone — warm nude / rose / mauve / berry
  → ⛔ DO NOT match lip color to outfit color
  → ⛔ DO NOT add bright red lipstick unless it clearly suits this specific skin tone
• Lashes: enhance what exists — defined and separated, NOT theatrical or fake-looking
• Overall: as if a professional makeup artist prepared them for Vogue — not a beauty pageant

LENS & FILM:
• 85mm portrait lens at f/2.0 — subject tack sharp, background creamy bokeh
• Kodak Portra 800 film aesthetic — warm, rich, dimensional
• Catchlights: 2 sharp white reflections in each iris — eyes alive and present

${aspectRatio ? `Aspect ratio: MATCH INPUT — ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional: ${customPrompt}` : ""}

══════════════════════════════════════════════════════
PHASE 4 — IDENTITY VERIFICATION (mandatory before rendering)
══════════════════════════════════════════════════════

Answer each question. If ANY answer is NO — rebuild that element before rendering:

1. Would this person's close friend IMMEDIATELY recognize them in this image? → MUST BE YES
2. Are the eyes the EXACT same color and spacing as in the source? → MUST BE YES
3. Is the nose the EXACT same shape — bridge width, tip, nostrils? → MUST BE YES
4. Is the face shape IDENTICAL — same cheekbones, jaw, chin? → MUST BE YES
5. Is the age IDENTICAL — not younger, not older? → MUST BE YES
6. Are hollow cheeks still hollow? Are full cheeks still full? → MUST BE YES
7. Is the hair the exact same cut and color? → MUST BE YES
8. Does the outfit color CONTRAST clearly with the background? → MUST BE YES
9. Does this look like a PROFESSIONAL FASHION MAGAZINE PHOTO (not a filtered selfie)? → MUST BE YES
10. Is this a SPECIFIC REAL PERSON — not a generic AI-generated model face? → MUST BE YES

All 10 = YES → render.
Any = NO → fix and rebuild before rendering.`;
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

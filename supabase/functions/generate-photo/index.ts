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

function getRandomGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, aspectRatio?: string): string {
  const garment = getRandomGarment();

  return `TASK: LUXURY FASHION PHOTOSHOOT — PHOTOREALISTIC IDENTITY TRANSFER

STEP 1 — SCAN & MEMORIZE THE PERSON IN THE INPUT PHOTO:
Before generating anything, carefully read and memorize ALL of the following from the source photo:
• IRIS COLOR: Exact hue (green / brown / blue / gray / hazel / amber) — note saturation and brightness
• FACE SHAPE: Round / oval / square / heart / diamond / oblong
• CHEEKBONE POSITION: How HIGH are the cheekbones? Are the cheeks HOLLOW (concave under the bone) or FULL (convex)? Measure the depth of the hollow under the zygomatic arch
• CHEEK HOLLOW DEPTH: Rate 1–5: 1=very full/round, 5=very hollow/sculpted. Write this number.
• ZYGOMATIC ARCH: Where exactly does the cheekbone protrude — high/mid/low on the face?
• NOSE: Bridge width, tip shape (rounded/pointed/wide/narrow), nostril spread
• CHIN: Length from lower lip to chin tip — short / medium / long
• JAW: Soft and rounded OR defined and angular? Note sharpness of jaw corners
• LOWER FACE WIDTH: Is the lower face narrow or wide relative to cheekbones?
• BROW: Arch height, thickness, distance from eye
• SKIN TONE: Fair / medium / olive / dark — exact undertone (warm/cool/neutral)
• HAIR: Color, length, texture
• AGE: Approximate range, do NOT de-age
• ANY DISTINCTIVE FEATURES: moles, freckles, asymmetry, unique traits

STEP 2 — LOCK ALL SCANNED VALUES. THIS IS YOUR BIOMETRIC BLUEPRINT.

════════════════════════════════════════
ABSOLUTE RULES — APPLY TO EVERY PERSON
════════════════════════════════════════

⛔ DO NOT "IMPROVE" or "BEAUTIFY" — IDENTITY TRANSFER only, not idealization
⛔ DO NOT change face shape — exact shape from Step 1
⛔ DO NOT change eye color — green stays green, brown stays brown, blue stays blue
⛔ DO NOT enlarge or reshape eyes — only add LIGHT (catchlights)

⛔⛔ CHEEKS — MOST CRITICAL RULE ⛔⛔
If you scanned HOLLOW cheeks (rating 3–5): the area UNDER the cheekbone MUST appear concave/sunken — not filled in, not softened, not rounded
If you scanned FULL cheeks (rating 1–2): keep them full
DO NOT add volume or fat to cheeks that are sculpted — this is the #1 forbidden mistake
DO NOT let diffuse lighting "fill in" the natural shadows under the cheekbones
The hollow under the zygomatic arch is STRUCTURAL — it does not disappear in fashion photos
PRESERVE the exact shadow shape in the cheek hollow area from the source photo

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
MAKEUP — EDITORIAL LUXURY
════════════════════════════════════════

- Foundation: skin looks like skin — pores visible, healthy glow, never plastic
- Blush: warm, placed high on cheekbones — complements the person's actual skin tone
- Lip color: choose the most flattering shade FOR THIS PERSON'S specific skin tone — deep nude-rose / warm mauve / sophisticated berry / soft terracotta — NEVER a random bright color, NEVER clashing with outfit
- Eye makeup: subtle definition that enhances without changing natural eye shape
- Overall: makeup looks professional, intentional, expensive

════════════════════════════════════════
CLOTHING & PHOTOGRAPHY
════════════════════════════════════════

Outfit: ${garment}

LIGHTING — CINEMATIC LUXURY:
- Main light: large octabox at 45° — defines cheekbones and jaw of THIS person's face
- Fill: white reflector — lifts shadows without losing depth
- Rim/hair light from behind: separates subject from background, premium 3D effect
- Catchlights MUST be visible in eyes — non-negotiable
- Mood: Vogue Italia editorial — rich, dimensional, three-dimensional

LENS & CAMERA: 85mm f/1.4, shot at f/2.8 — subject sharp, background creamy bokeh
FILM AESTHETIC: Kodak Portra 800 — warm, rich tones, natural contrast, not oversaturated
BACKGROUND: seamless paper, neutral warm gray or ivory — luxury studio feel

${aspectRatio ? `Aspect ratio: MATCH INPUT EXACTLY — ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional: ${customPrompt}` : ""}

════════════════════════════════════════
FINAL QUALITY CHECK
════════════════════════════════════════

Before rendering, confirm:
✅ Eye color MATCHES source exactly (green/brown/blue/etc — not altered)
✅ Face shape IDENTICAL — no rounding, no slimming
✅ Cheeks MATCH source — hollow if hollow, full if full
✅ Jaw and chin IDENTICAL proportions
✅ Eyes have CATCHLIGHTS — bright, sharp, alive
✅ Expression is WARM and CONFIDENT — not scared, not stiff
✅ Lip color is FLATTERING for this specific person
✅ Photo looks like it belongs in a LUXURY FASHION MAGAZINE
✅ The person is 100% RECOGNIZABLE as themselves

Ask yourself: "Would the person in the input photo look at this result and say — that's ME, but in Vogue?"`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured. Set LOVABLE_API_KEY in secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, stylePrompt, customPrompt, originalDimensions } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate aspect ratio string from original dimensions
    let aspectRatio: string | undefined;
    if (originalDimensions?.width && originalDimensions?.height) {
      const w = originalDimensions.width;
      const h = originalDimensions.height;
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(w, h);
      aspectRatio = `${w / divisor}:${h / divisor} (${w}x${h} pixels)`;
      console.log(`Original aspect ratio: ${aspectRatio}`);
    }

    const fullPrompt = buildPrompt(stylePrompt || "", customPrompt || "", aspectRatio);

    console.log("Calling Lovable AI Gateway with model google/gemini-3-pro-image-preview");

    // Use Lovable AI Gateway for image generation
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
      const errorText = await response.text();
      console.error(`AI Gateway error: ${response.status}`, errorText);

      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI-кредиты исчерпаны. Пополните баланс в Workspace Settings → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI Gateway response received");

    // Extract generated image from response
    const generatedImage =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "No image returned from AI model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl: generatedImage }),
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

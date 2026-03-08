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

════════════════════════════════════════
BIOMETRIC LOCK — FACE GEOMETRY IS SACRED
════════════════════════════════════════

⛔ DO NOT change face shape — no vertical compression, no oval-face "improvement"
⛔ DO NOT resize or reposition features — nose width, chin length, jaw angle are locked
⛔ DO NOT enlarge eyes or change their shape — only add LIGHT to them (see below)
⛔ DO NOT de-age, smooth skin aggressively, or alter real age
⛔ DO NOT change hair length or texture

CLONE EXACTLY FROM SOURCE PHOTO:
- Eye shape, width, inter-ocular distance, upper/lower lid shape, brow arch
- EYE COLOR: measure the EXACT iris hue from source — if GREEN, render VIVID GREEN, not hazel, not gray, not brown — GREEN
- Nose: bridge width, tip shape, nostril size, nose length
- Chin: EXACT length from lower lip to chin tip — DO NOT shorten
- Jawline angle, mandible width — IDENTICAL
- Face height-to-width ratio — MEASURE AND LOCK
- Forehead height, cheekbone position and prominence — COPY EXACTLY
- ⛔ DO NOT add volume to cheeks — if the face has hollow/sculpted cheeks, keep them hollow and sculpted
- ⛔ DO NOT round the face — angular, defined cheekbones must stay angular and defined
- Cheek hollows depth, zygomatic arch height — IDENTICAL to source
- Skin tone, age markers, distinctive features (moles, asymmetry)

════════════════════════════════════════
✨ WOW FACTOR — WHAT MUST BE TRANSFORMED
════════════════════════════════════════

EXPRESSION & POSE — MOST IMPORTANT FOR WOW RESULT:
⛔ ABSOLUTELY FORBIDDEN: passport photo expression, scared look, stiff frozen face, tense jaw, wide frightened eyes
✅ REQUIRED: natural, relaxed, CONFIDENT expression — the person looks like they OWN the room
- Lips: soft, slightly parted OR a subtle natural closed smile — warm, approachable, NOT forced grin, NOT frozen neutral
- Jaw: relaxed, not clenched — slight softness under the chin
- Head: very slight tilt (~5°) or natural straight — NEVER rigid passport-photo straight
- Shoulders: relaxed, dropped naturally — not stiff or raised
- The overall feeling: "I am exactly where I want to be. I am confident and beautiful."
- Think: Cate Blanchett on a magazine cover — effortless, present, magnetic
- Think: the person just heard something slightly amusing and is about to smile

EYES — ALIVE AND MAGNETIC (geometry unchanged, only light):
- Add SHARP CATCHLIGHTS: 2 bright white reflections in each iris (one large ~2 o'clock, one small ~8 o'clock) — this is what separates a dead photo from a WOW photo
- Iris must have depth and micro-texture — visible crystalline pattern
- The gaze must feel PRESENT, WARM, ENGAGED — eyes have a subtle inner smile even if lips are neutral
- Slight moisture on the lower lashline for natural luminosity
- Lashes: defined, separated, naturally long — not cartoon — think high-fashion Vogue editorial
- IMPORTANT: all of this is achieved through LIGHTING only, NOT by changing eye shape, size or inter-ocular distance

MAKEUP — EDITORIAL LUXURY:
- Foundation: skin must look like skin — pores visible, healthy glow, not plastic
- Blush: warm and sculpted, placed high on cheekbones
- Lip color: choose the most FLATTERING shade for this person's skin tone — options: deep nude-rose, warm mauve, sophisticated berry, soft terracotta — NEVER random bright colors, NEVER garish pink, NEVER color that clashes with the outfit
- Eye makeup: subtle definition that opens the eye and complements the style without changing the eye's natural shape
- Overall: makeup must look professional, intentional, expensive

════════════════════════════════════════
CLOTHING & PHOTOGRAPHY
════════════════════════════════════════
Outfit: ${garment}

LIGHTING — CINEMATIC LUXURY:
- Main light: large octabox at 45° — creates beautiful shadows that define cheekbones and jaw
- Fill: white reflector on opposite side — lifts shadows without killing depth
- Rim/hair light from behind: separates subject from background, adds premium 3D effect
- Eye lights: catch lights MUST be visible — this is non-negotiable for WOW quality
- Overall mood: Vogue Italia editorial — rich, dimensional, three-dimensional

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
✅ Face geometry IDENTICAL to source (chin length, jaw angle, face proportions)
✅ Eyes have CATCHLIGHTS — bright, sharp, alive
✅ Lip color is FLATTERING and intentional — not random, not garish
✅ Photo looks like it belongs in a LUXURY FASHION MAGAZINE
✅ The person looks like THEMSELVES — just in a better photoshoot

This photo must make the client say "WOW — that's me, but in Vogue."`;
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

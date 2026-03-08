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

  return `PHOTOREALISTIC IDENTITY TRANSFER — ZERO ARTISTIC INTERPRETATION

⛔ ABSOLUTE RULE #1: DO NOT BEAUTIFY THE FACE. DO NOT "IMPROVE" ANY FEATURE.
⛔ ABSOLUTE RULE #2: DO NOT ENLARGE THE EYES. DO NOT CHANGE EYE SHAPE.
⛔ ABSOLUTE RULE #3: THIS IS NOT AN ILLUSTRATION. THIS IS A REAL PHOTO OF A REAL PERSON.

════════════════════════════════════════
BIOMETRIC LOCK — READ THE INPUT PHOTO PIXEL BY PIXEL
════════════════════════════════════════

EYES — THE MOST CRITICAL ELEMENT:
Measure the EXACT eye dimensions from the source photo:
- Eye opening HEIGHT (vertical aperture): CLONE EXACTLY. If eyes look tired/heavy — keep them exactly that way.
- Eye WIDTH (inner to outer corner): CLONE EXACTLY — DO NOT make wider
- Inter-ocular distance: measure in pixels — DO NOT bring eyes closer OR further
- Upper eyelid fold: if hooded — keep hooded. If heavy — keep heavy. DO NOT lift the lid.
- Lower eyelid: if there is undereye area showing — CLONE it exactly
- Outer corner tilt: upward/neutral/downward — LOCK THIS ANGLE, do not alter
- Eyebrow shape, thickness, arch, gap from eye: IDENTICAL — do not raise or thicken
- Eye size relative to face: MUST MATCH SOURCE. DO NOT make eyes appear larger.
- Iris color: exact shade, do NOT make brighter or more vivid
⛔ MOST FORBIDDEN: making eyes bigger, rounder, more "open", more "beautiful" — PROHIBITED

NOSE:
- Bridge width: CLONE EXACTLY — do not narrow
- Tip shape: CLONE EXACTLY — do not refine or lift
- Nostril size and shape: IDENTICAL
- Nose length: CLONE EXACTLY

LIPS:
- Mouth width: CLONE EXACTLY
- Upper lip Cupid's bow shape: IDENTICAL
- Lower lip fullness: CLONE — do not inflate
- Lip color: natural, match source

CHIN & JAW:
- Chin LENGTH (lower lip to chin tip in pixels): CLONE EXACTLY — DO NOT shorten
- Chin shape (pointed/square/round): LOCK AND CLONE
- Jawline angle from ear to chin: IDENTICAL
- Mandible width at widest point: CLONE
⛔ FORBIDDEN: shortening chin, softening jaw, adding roundness not in source

FACE SHAPE:
- Face height-to-width ratio: MEASURE AND CLONE EXACTLY
- Forehead height: CLONE
- Cheekbone position and prominence: IDENTICAL to source
- Overall face: if narrow — keep narrow. If long — keep long.
⛔ FORBIDDEN: vertical compression, horizontal widening, "oval face" beautification

SKIN & AGE:
- Skin tone: exact match
- Natural texture, pores, fine lines: PRESERVE — do not smooth or blur
- Real age: KEEP — no de-aging
- Any distinctive features (moles, asymmetry): CLONE

HAIR:
- Length: IDENTICAL — do not lengthen or shorten
- Texture and style: CLONE EXACTLY
- Color: exact match

════════════════════════════════════════
CLOTHING & SETTING
════════════════════════════════════════
Outfit: ${garment}
Lighting: natural studio light, soft and even, 85mm portrait lens
Background: clean, neutral, slightly blurred
Film aesthetic: Kodak Portra 400 — natural colors, no heavy grading

${aspectRatio ? `Output aspect ratio: MUST match input EXACTLY — ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Extra: ${customPrompt}` : ""}

════════════════════════════════════════
FINAL CHECK BEFORE RENDERING
════════════════════════════════════════
Ask yourself: "Does this face look EXACTLY like the person in the input photo?"
If ANY feature was changed — eyes larger, chin shorter, nose thinner, face rounder — REDO IT.
The viewer must immediately recognize this as THE SAME PERSON.
The face must NOT look "AI-generated pretty" — it must look REAL and IDENTICAL.

OUTPUT: One ultra-realistic photograph. Same person, same face geometry, same eyes, same chin. Only the clothing and background changed.`;
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

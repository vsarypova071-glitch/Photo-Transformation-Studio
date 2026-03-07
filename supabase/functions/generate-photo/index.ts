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

  return `ULTRA-REALISTIC LUXURY EDITORIAL PORTRAIT — IDENTITY + MAGNETISM

═══════════════════════════════
STEP 1 — DEEP FACE SCAN (DO THIS FIRST)
═══════════════════════════════
Before generating, carefully analyze and memorize EVERY facial parameter:
- Exact skull shape, forehead width and height
- Precise jawline contour and chin shape
- Exact cheekbone position and prominence
- Nose: bridge width, tip shape, nostril size and flare
- Eyes: exact shape (almond/round/hooded), size, spacing between eyes, inner and outer corner angles, iris color and pattern, eyebrow arch and thickness
- Lips: exact Cupid's bow, lower lip fullness, mouth width, lip corners position
- Skin: exact tone, texture, pores, any moles, freckles, marks — reproduce them ALL
- Real age — NO de-aging, NO smoothing, NO airbrushing
- The person must be 100% RECOGNIZABLE — same person, zero doubt

═══════════════════════════════
STEP 2 — PRESERVE BODY & HAIR
═══════════════════════════════
- Hair: exact length, color, texture, parting. Zero restyling.
- Body: exact proportions, weight, build, shoulder width. Clothing fits the real body.

${aspectRatio ? `═══════════════════════════════
STEP 3 — ASPECT RATIO (MANDATORY)
═══════════════════════════════
- Output MUST match input aspect ratio EXACTLY: ${aspectRatio}
- No cropping, no letterboxing, no composition ratio changes` : ""}

═══════════════════════════════
STEP 4 — WARDROBE
═══════════════════════════════
${garment}
Precision-tailored, premium fabrics, fitted to this exact body.

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Extra direction: ${customPrompt}` : ""}

═══════════════════════════════
STEP 5 — LIVING ENERGY & MAGNETISM (CRITICAL)
═══════════════════════════════
This is NOT a static portrait. This is a LIVING, BREATHING moment captured.

EYES — THE SOUL:
- Eyes must radiate INTELLIGENCE, DEPTH, POWER
- Catch-lights: one strong specular highlight + soft secondary reflection in each iris
- Iris rendered with full micro-detail: texture, limbal ring, depth
- Slight natural moisture on the waterline — eyes look ALIVE, not flat
- Gaze: confident, magnetic, slightly knowing — like she holds a secret

SKIN — ALIVE NOT PLASTIC:
- Natural luminosity: skin glows from within, not from post-processing
- Subtle flush of warmth at cheekbones and temples
- Fine texture visible under light — real pores, real skin
- No smoothing, no blur, no AI skin — RAW, real, radiant

EXPRESSION — MAGNETIC PRESENCE:
- Lips slightly parted or softly pressed — natural tension
- Micro-expression: a hint of a smile that never fully arrives — mysterious
- Jaw relaxed, neck elongated — effortless authority
- The whole face communicates: "I know exactly who I am"

ENERGY — SENSUAL & POWERFUL:
- Posture: shoulders slightly back, chest open — confident ownership of space
- The image should make the viewer feel a physical pull toward the subject
- Charisma is visible — not performative, but intrinsic

═══════════════════════════════
CAMERA & LIGHT
═══════════════════════════════
- 85mm f/1.2 lens — razor-sharp on eyes, silky bokeh everywhere else
- Split Rembrandt lighting: one key light from 45° above creating triangle shadow under eye
- Warm golden fill light from opposite side — 3:1 ratio
- Hair light from behind — separates subject from background, creates halo
- Film: Kodak Portra 800 aesthetic — warm shadows, creamy highlights, fine grain
- Color grade: rich shadows, glowing skin tones, desaturated background
- Depth of field: eyes in perfect focus, background 40% blur

OUTPUT: One ultra-realistic luxury editorial photograph. The face must be the same person. The energy must be magnetic, alive, sensual, powerful. Aspect ratio: identical to input.`;
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

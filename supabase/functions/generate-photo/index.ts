import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit",
  "bespoke structured blazer in premium cashmere",
  "individually tailored silk blouse with high-waist trousers",
  "architectural clean-line couture coat",
  "luxury monochrome power suit",
];

function getRandomGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `
You are performing a PROFESSIONAL HIGH-END IMAGE EDIT.
This is NOT regeneration. Keep the same person.

FACE:
Keep exact skull, jawline, nose, eyes, lips, asymmetry.
No beautification.
No reshaping.
No smoothing.
No symmetry correction.

HAIR:
Same length, density, texture, hairline.
No volume increase.

BODY:
Preserve exact chest size.
No bust enlargement.
No waist slimming.
Clothing adapts to body.

WARDROBE:
${garment}

${stylePrompt || ""}
${customPrompt || ""}

Luxury editorial quality.
Natural lighting.
85mm lens realism.
Ultra photorealistic.
`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { imageBase64, stylePrompt, customPrompt } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const fullPrompt = buildPrompt(stylePrompt || "", customPrompt || "");

    const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanedBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            topP: 0.7,
          },
        }),
      }
    );

    const data = await response.json();

    const imagePart = data?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      return new Response(
        JSON.stringify({ error: "No image returned from Gemini" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});



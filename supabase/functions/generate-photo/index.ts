import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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
];

function getRandomGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `
PROFESSIONAL LUXURY EDITORIAL PHOTO EDIT

CORE RULE: IDENTITY LOCK

This is an EDIT of the uploaded image.
DO NOT regenerate the person.
Preserve 100% facial structure.

FACE LOCK:
- Exact skull shape
- Exact jawline
- Exact cheekbones
- Exact nose
- Exact eye spacing
- Exact lips
- Preserve skin texture
- Preserve real age
- ZERO beautification
- ZERO reshaping
- ZERO smoothing

HAIR:
- Exact length
- Exact texture
- No volume increase
- No restyling

BODY:
- Preserve chest size
- Preserve waist
- Preserve proportions
- Clothing adapts to body

EYES:
- Natural catchlights
- Sharp but realistic

WARDROBE:
${garment}
Luxury tailoring.
Premium fabrics.
Individually fitted.

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Extra direction: ${customPrompt}` : ""}

CAMERA:
85mm lens
Natural depth of field
Soft cinematic lighting
Film realism
No HDR
No plastic skin

OUTPUT:
One ultra realistic luxury editorial photograph.
Identity above everything.
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, stylePrompt, customPrompt } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullPrompt = buildPrompt(stylePrompt || "", customPrompt || "");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-vision-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return new Response(
        JSON.stringify({ error }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const generated =
      data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inline_data)?.inline_data?.data;

    if (!generated) {
      return new Response(
        JSON.stringify({ error: "No image returned from Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        imageBase64: `data:image/png;base64,${generated}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



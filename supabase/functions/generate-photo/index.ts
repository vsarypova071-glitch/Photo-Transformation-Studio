import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WARDROBE: string[] = [
  "minimal tailored beige suit",
  "luxury cream cashmere coat",
  "modern silk blouse with high-waist trousers",
  "structured wool blazer with clean lines",
];

function getRandomGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are performing a HIGH-END IMAGE EDIT.

━━━━━━━━━━━━━━━━━━━━
IDENTITY IS ABSOLUTE PRIORITY
━━━━━━━━━━━━━━━━━━━━

The uploaded image is the BASE LAYER.
Modify clothing and environment ONLY.
Do NOT regenerate the face.

FACE — STRICT PRESERVATION:

• Preserve exact skull structure.
• Preserve exact jawline and chin length.
• Preserve exact eye spacing and eyelid shape.
• Preserve exact eyebrow shape and thickness.
• Preserve exact nose bridge and nostrils.
• Preserve exact lip proportions.
• Preserve natural asymmetry.
• Preserve real skin texture (no smoothing).
• Same age. Same ethnicity.
• ZERO beautification.
• ZERO reshaping.
• ZERO symmetry correction.

CRITICAL:
Do NOT reinterpret facial lighting.
Do NOT modify bone structure.
Do NOT alter expression geometry.

━━━━━━━━━━━━━━━━━━━━
HAIR — EXACT COPY
━━━━━━━━━━━━━━━━━━━━

• Same length.
• Same hairline.
• Same texture.
• No volume increase.
• No style change.

━━━━━━━━━━━━━━━━━━━━
BODY — ABSOLUTE PRESERVATION
━━━━━━━━━━━━━━━━━━━━

• Preserve exact chest size.
• Preserve exact body proportions.
• Do NOT enhance bust.
• Do NOT exaggerate curves.
• Do NOT slim waist.
• Do NOT reshape hips.
• Garment must adapt to body — body must NOT adapt to garment.
• Avoid body enhancement through lighting or shadow shaping.
• Do NOT emphasize chest area.

━━━━━━━━━━━━━━━━━━━━
STYLE
━━━━━━━━━━━━━━━━━━━━

Luxury editorial photography.
Premium tailoring.
Modern minimal elegance.
Natural cinematic depth of field.
Professional optical lens realism.
High detail fabric texture.

Eyes must look alive and sharp.
Skin must look real — not plastic.
Photo must feel like high-end magazine editorial.

Wardrobe:
${garment}

${stylePrompt ? `Additional style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional custom direction: ${customPrompt}` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━

different person,
face regeneration,
facial reconstruction,
beautification,
AI smoothing,
plastic skin,
symmetry correction,
age change,
hair length change,
weight change,
body reshaping,
bust enlargement,
waist slimming,
cartoon,
CGI,
illustration,
low quality.

OUTPUT:
One ultra realistic luxury fashion photograph.
Identity preservation above everything.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        temperature: 0.2,
        top_p: 0.8,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: fullPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const choice = data?.choices?.[0];

    let generatedImageUrl =
      choice?.message?.images?.[0]?.image_url?.url ||
      choice?.message?.content?.find((p: any) => p.type === "image_url")?.image_url?.url;

    if (!generatedImageUrl) {
      return new Response(
        JSON.stringify({ error: "Model did not return an image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



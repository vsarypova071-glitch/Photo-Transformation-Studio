import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WARDROBE_2026: Record<string, string[]> = {
  power_chic: [
    "oversized structured blazer in oatmeal cashmere",
    "cropped black leather blazer with tailored trousers",
    "double-breasted sand linen suit",
    "ivory oversized coat with wide pants",
  ],
  modern_elegant: [
    "champagne satin slip dress",
    "one-shoulder black crepe midi dress",
    "dove grey silk column dress",
    "navy halter-neck gown",
  ],
  luxe_casual: [
    "cashmere hoodie with tailored joggers",
    "white linen shirt with cream trousers",
    "silk bomber jacket with chinos",
  ],
};

function getRandomGarment(): string {
  const categories = Object.keys(WARDROBE_2026);
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const items = WARDROBE_2026[cat];
  return items[Math.floor(Math.random() * items.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are performing a STRICT IMAGE EDIT.

━━━━━━━━━━━━━━━━━━━━
IDENTITY PRIORITY LEVEL: 100
STYLE PRIORITY LEVEL: 30
If conflict occurs — ALWAYS prioritize identity.
━━━━━━━━━━━━━━━━━━━━

ABSOLUTE RULE:
The generated person MUST be the exact same person as in the reference image.

FACE — EXACT COPY:
• Preserve exact skull structure, jawline, chin length.
• Preserve exact eye spacing, eyelid shape, iris color.
• Preserve exact eyebrow thickness and arch.
• Preserve exact nose bridge, nostrils, tip shape.
• Preserve exact lip shape and proportions.
• Preserve natural skin texture and tone.
• Same age. Same ethnicity.
• ZERO beautification.
• ZERO reshaping.

CRITICAL:
Do NOT reinterpret lighting on the face.
Preserve original facial shadows.
Do NOT smooth skin.
Do NOT modify bone structure.

HAIR — STRICT COPY:
• Same length.
• Same hairline.
• Same texture.
• No added volume.
• No lengthening.

BODY:
• Same proportions.
• No slimming.
• No reshaping.

━━━━━━━━━━━━━━━━━━━━
STYLE
━━━━━━━━━━━━━━━━━━━━
${stylePrompt || "Luxury portrait"}

WARDROBE:
${garment}

Garment must fit real body proportions.

${customPrompt ? `ADDITIONAL DIRECTION:\n${customPrompt}` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE
━━━━━━━━━━━━━━━━━━━━
different person, face change, age change, hair length change,
body reshaping, beautification, AI smoothing,
plastic skin, symmetry correction, glam filter,
cartoon, CGI, illustration, blurry.

OUTPUT: One ultra realistic photograph. Preserve identity above everything.`;
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


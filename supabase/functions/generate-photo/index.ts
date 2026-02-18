import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit, perfect proportions",
  "bespoke structured blazer in premium cashmere",
  "individually tailored silk blouse with high-waist trousers",
  "architectural clean-line couture coat",
  "luxury monochrome power suit, precision tailoring",
];

function getRandomGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are performing a PROFESSIONAL HIGH-END IMAGE EDIT.

━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRINCIPLE: IDENTITY LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━

The uploaded image is the BASE.
This is an EDITING task — NOT regeneration.

You MUST keep the person 100% identical.

━━━━━━━━━━━━━━━━━━━━━━━━━━
FACE — ABSOLUTE PRESERVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━

• Exact skull shape.
• Exact jawline width and chin length.
• Exact cheekbone structure.
• Exact nose bridge, nostrils, tip.
• Exact eye distance and eyelid geometry.
• Exact eyebrow thickness and angle.
• Exact lip proportions and natural asymmetry.
• Preserve skin texture, pores, micro details.
• Preserve real age.
• Preserve ethnicity.
• ZERO beautification.
• ZERO symmetry correction.
• ZERO facial reshaping.
• ZERO AI smoothing.

Do NOT reinterpret lighting on facial bone structure.
Do NOT enhance cheekbones.
Do NOT slim face.

If unsure → copy original face more literally.

━━━━━━━━━━━━━━━━━━━━━━━━━━
HAIR — EXACT COPY
━━━━━━━━━━━━━━━━━━━━━━━━━━

• Same length.
• Same density.
• Same texture.
• Same hairline.
• Same color.
• No added volume.
• No length change.
• No restyling.

━━━━━━━━━━━━━━━━━━━━━━━━━━
BODY — LOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━

• Preserve exact chest size.
• Preserve natural bust volume.
• DO NOT enlarge bust.
• DO NOT reshape torso.
• DO NOT slim waist.
• DO NOT exaggerate hips.
• Clothing must adapt to the body.
• Body must NEVER adapt to clothing.
• Avoid shadow sculpting that enhances curves.

This is critical.

━━━━━━━━━━━━━━━━━━━━━━━━━━
EYES — ALIVE BUT NATURAL
━━━━━━━━━━━━━━━━━━━━━━━━━━

• Natural catchlights.
• Sharp but realistic.
• No artificial glow.
• No glassy AI stare.

━━━━━━━━━━━━━━━━━━━━━━━━━━
WARDROBE
━━━━━━━━━━━━━━━━━━━━━━━━━━

The outfit must look individually tailored to THIS body.
Premium materials only.
Luxury editorial level.
No costume look.

Garment:
${garment}

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional direction: ${customPrompt}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━
LIGHT & CAMERA
━━━━━━━━━━━━━━━━━━━━━━━━━━

Shot on 85mm lens.
Natural depth of field.
Soft directional lighting.
No HDR.
No over-sharpening.
No plastic skin.
Film-like realism.

━━━━━━━━━━━━━━━━━━━━━━━━━━
NEGATIVE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━

different person,
face reconstruction,
face regeneration,
beautification,
plastic skin,
symmetry correction,
age change,
hair length change,
weight change,
bust enlargement,
waist slimming,
body reshaping,
AI glamour filter,
cartoon,
CGI,
illustration,
low quality.

━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━

One ultra realistic luxury editorial photograph.
Identity preservation is above everything.`;
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
        temperature: 0.15,
        top_p: 0.7,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: fullPrompt },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
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


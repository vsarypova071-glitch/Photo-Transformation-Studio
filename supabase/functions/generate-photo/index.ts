import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GARMENT_VARIATIONS = [
  "structured tailored blazer",
  "flowing silk couture blouse",
  "architectural high-fashion dress",
  "luxury monochrome power suit",
  "minimalist cashmere ensemble",
  "avant-garde asymmetrical outfit",
  "fine linen Italian tailoring",
  "layered couture styling",
];

function getRandomGarment() {
  return GARMENT_VARIATIONS[Math.floor(Math.random() * GARMENT_VARIATIONS.length)];
}

function buildPrompt(styleKeywords: string, isPremium: boolean) {
  const garment = getRandomGarment();

  const identityLock = `
IDENTITY PRESERVATION RULES:
- The uploaded image is the identity reference.
- Maintain the exact facial structure.
- Do not modify nose geometry.
- Do not alter cheekbone structure.
- Keep original jawline shape.
- Preserve eye spacing and eyelid form.
- No beautification. No face reshaping.
- Natural skin texture only.
`;

  const cleanRules = `
STRICT OUTPUT RULES:
- No text, letters, typography, logos, branding.
- No magazine layouts, headlines, graphic overlays, watermarks.
- Clean professional photograph only.
`;

  const premiumEnhancement = isPremium
    ? `
PREMIUM PRODUCTION QUALITY:
- Cinematic lighting with depth.
- Professional high-fashion posing.
- Micro-detail couture fabric textures.
- Luxury depth of field.
- Ultra realistic skin rendering.
- Advanced shadow modeling.
`
    : "";

  return `
You are a world-class luxury fashion photographer.

Create a hyper-realistic high-end fashion portrait.

STYLE:
${styleKeywords}

GARMENT CONSTRUCTION:
${garment}

${identityLock}

${cleanRules}

${premiumEnhancement}

Camera:
- 85mm or 135mm portrait lens
- RAW photography style
- Professional studio lighting
- High resolution detail
- Strictly photorealistic
`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, stylePrompt, isPremium, customPrompt } = await req.json();

    if (!imageBase64 || !stylePrompt) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or stylePrompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const finalPrompt = buildPrompt(stylePrompt, isPremium || false);
    const fullPrompt = customPrompt
      ? `${finalPrompt}\n\nAdditional user instructions: ${customPrompt}`
      : finalPrompt;

    console.log("Calling AI gateway for image generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
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
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Недостаточно средств на AI-сервисе." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Ошибка AI-сервиса" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image in AI response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Модель не вернула изображение. Попробуйте другой стиль." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Image generated successfully");

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-photo error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

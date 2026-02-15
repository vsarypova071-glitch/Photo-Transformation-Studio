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

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    const finalPrompt = buildPrompt(stylePrompt, isPremium || false);
    const fullPrompt = customPrompt
      ? `${finalPrompt}\n\nAdditional user instructions: ${customPrompt}`
      : finalPrompt;

    console.log("Calling Google Gemini API directly...");

    // Extract base64 data from data URL if needed
    let imageData = imageBase64;
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageData = match[2];
      }
    }

    const modelName = "gemini-2.5-flash-image";
    console.log("Using model:", modelName);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_AI_API_KEY}`,
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
                    mimeType,
                    data: imageData,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google API error:", response.status, errText);

      // Forward specific error details to client
      let errorMessage = "Ошибка AI-сервиса";
      try {
        const errData = JSON.parse(errText);
        const apiMsg = errData?.error?.message || "";
        if (response.status === 429) errorMessage = "Слишком много запросов. Попробуйте позже.";
        else if (response.status === 403) errorMessage = "API-ключ не имеет доступа к этой модели. Проверьте настройки в Google AI Studio.";
        else if (response.status === 400 && apiMsg.includes("API key")) errorMessage = "Неверный API-ключ.";
        else if (response.status === 400) errorMessage = `Ошибка запроса: ${apiMsg.slice(0, 150)}`;
        else if (response.status === 404) errorMessage = "Модель не найдена. Обратитесь в поддержку.";
      } catch { /* use default */ }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status >= 400 ? response.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Google Gemini direct API response format
    const parts = data.candidates?.[0]?.content?.parts;
    let generatedImageUrl: string | undefined;
    
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

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

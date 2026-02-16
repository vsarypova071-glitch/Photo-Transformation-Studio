import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not set" }),
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

    const fullPrompt = `
ULTRA LUXURY HIGH-END FASHION PHOTOGRAPHY.

STRICT IDENTITY LOCK:
- Preserve EXACT face
- Preserve exact facial structure
- Preserve age
- Preserve proportions
- Do NOT beautify
- Do NOT slim body
- Do NOT change ethnicity
- Maintain real skin texture

STYLE:
${stylePrompt || "Luxury editorial fashion portrait"}

${customPrompt || ""}

Professional cinematic lighting.
Shot on Hasselblad H6D.
Ultra detailed 8k.
Natural skin texture.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();

    let generatedImageUrl: string | null = null;

    const choice = data?.choices?.[0];

    // Format 1
    if (choice?.message?.images?.[0]?.image_url?.url) {
      generatedImageUrl = choice.message.images[0].image_url.url;
    }

    // Format 2 (Gemini 2.5 Flash)
    if (!generatedImageUrl && Array.isArray(choice?.message?.content)) {
      const imagePart = choice.message.content.find(
        (part: any) => part.type === "image_url"
      );
      if (imagePart?.image_url?.url) {
        generatedImageUrl = imagePart.image_url.url;
      }
    }

    if (!generatedImageUrl) {
      console.error("AI RESPONSE:", JSON.stringify(data).slice(0, 1000));
      return new Response(
        JSON.stringify({ error: "Model did not return image" }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});


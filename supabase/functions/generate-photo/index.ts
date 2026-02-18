import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WARDROBE_2026 = [
  "sleek oversized blazer in soft beige cashmere over a white silk camisole, tailored wide-leg trousers — The Row aesthetic",
  "tailored cropped blazer in ivory with matching high-waist cigarette pants, minimal gold jewelry — Celine style",
  "slip dress in liquid champagne satin, delicate chain necklace, strappy heels — Bottega Veneta evening",
  "one-shoulder midi dress in deep emerald crepe, sculptural earrings — modern gala look",
  "relaxed linen suit in sand, open collar white shirt, tan loafers — luxury resort editorial",
  "structured leather trench coat in cognac over a black cashmere turtleneck and slim trousers",
  "minimalist black column dress with architectural shoulders, single statement ring — power elegance",
  "high-waist wide-leg jeans with tucked-in cream cashmere sweater and Hermès-style belt",
  "tailored charcoal wool coat over a silk blouse and pleated midi skirt — Milan street style",
  "modern power suit in navy pinstripe, fitted vest underneath, pointed stilettos — boss energy",
  "flowing silk maxi dress in muted terracotta with delicate gold chain belt — Ibiza luxury",
  "crisp white oversized shirt dress cinched with a wide leather belt, knee-high boots",
  "cashmere co-ord set in dove grey — cropped cardigan and wide trousers, minimal accessories",
  "black tuxedo jacket worn as a dress with sheer tights and satin pumps — evening chic",
  "knit polo top in cream paired with tailored bermuda shorts and leather sandals — yacht style",
  "sleeveless trench dress in camel with gold hardware details — modern sophistication",
  "silk palazzo pants in midnight blue with matching draped blouse — elegant dinner look",
  "fitted leather jacket in butter-soft black over a white tee and high-waist tailored trousers",
  "asymmetric cut-out dress in stark white, minimalist aesthetic — architectural fashion",
  "rich wool turtleneck in deep burgundy paired with leather pencil skirt — winter luxury",
];

function getRandomGarment(): string {
  return WARDROBE_2026[Math.floor(Math.random() * WARDROBE_2026.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are performing a PROFESSIONAL IMAGE EDIT, not full regeneration.

━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULE: CLONE THE PERSON
━━━━━━━━━━━━━━━━━━━━
The uploaded image is the BASE. Keep the EXACT same person — pixel-perfect.

FACE — PIXEL-PERFECT COPY:
• Preserve exact skull structure, jawline, chin, cheekbones.
• Preserve eye spacing, eyelid shape, iris color, eye size.
• Preserve nose bridge width, nostril shape, tip angle.
• Preserve lip shape, thickness, proportions.
• Preserve ALL natural asymmetry — do NOT correct anything.
• Preserve skin texture, pores, marks — NO smoothing, NO beautification.
• Same age. Same ethnicity. Same expression geometry.

HAIR — EXACT COPY:
• SAME length — do NOT add even 1cm.
• SAME texture and volume — no extra body or curls.
• SAME hairline and parting.
• If short hair — keep it short. If tied up — keep tied up.

BODY — ZERO CHANGES:
• Preserve exact weight, bust, waist, hips.
• NO slimming, NO enhancement, NO reshaping.
• Clothing must fit the REAL body as-is.

━━━━━━━━━━━━━━━━━━━━
CLOTHING — 2026 LUXURY
━━━━━━━━━━━━━━━━━━━━
Modern made-to-measure tailoring, premium fabrics.
Style: ${garment}

BANNED: bows, ruffles, velvet gowns, puffy sleeves, dated silhouettes, costume-like outfits, off-shoulder ball gowns, anything pre-2020.

━━━━━━━━━━━━━━━━━━━━
ENERGY & MAGNETISM
━━━━━━━━━━━━━━━━━━━━
• Eyes MUST sparkle — wet highlights, full of life and intention.
• Skin glows with natural dewy luminosity, sun-kissed warmth.
• Micro-expression of quiet confidence — the person radiates charisma.
• The photo must feel ALIVE — as if you could reach in and touch them.

━━━━━━━━━━━━━━━━━━━━
PHOTOGRAPHY — RAW REALISM
━━━━━━━━━━━━━━━━━━━━
Shot on 85mm f/1.4 prime lens. Shallow depth of field.
Film grain (ISO 400–800). Deep sculpted shadows.
Natural catchlights in eyes. No artificial glow. No plastic skin.
Professional editorial lighting that preserves facial structure.

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Custom direction: ${customPrompt}` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE
━━━━━━━━━━━━━━━━━━━━
different person, face regeneration, body reshaping, bust enlargement,
waist slimming, AI beautification, plastic skin, symmetry correction,
hair lengthening, hair color change, cartoon, CGI, illustration,
old-fashioned clothes, bows, ruffles, velvet, costume.

OUTPUT: One ultra-realistic luxury fashion photograph. Identity MUST remain intact.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, stylePrompt, customPrompt } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = buildPrompt(stylePrompt || "", customPrompt || "");
    const model = "google/gemini-3-pro-image-preview";
    console.log(`Calling Lovable AI Gateway with model ${model}`);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Gateway error: ${response.status} ${errorText}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов. Попробуйте через минуту." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Недостаточно кредитов AI. Пополните баланс в настройках workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageUrl =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-photo error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

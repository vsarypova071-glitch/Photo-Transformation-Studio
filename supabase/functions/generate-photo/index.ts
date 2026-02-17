import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Modern 2026 Luxury Wardrobe ──
const WARDROBE_2026: Record<string, string[]> = {
  power_chic: [
    "oversized structured blazer in oatmeal cashmere, no blouse underneath, bare décolleté, The Row aesthetic",
    "cropped black leather blazer over white silk bralette, tailored wide-leg trousers, Bottega Veneta style",
    "double-breasted sand linen suit, relaxed fit, no shirt underneath, Loro Piana vibe",
    "ivory oversized coat draped on shoulders, matching wide pants, Celine minimalism",
    "charcoal pinstripe power suit, cropped jacket, high-waist straight pants, Max Mara 2026",
  ],
  modern_elegant: [
    "liquid satin slip dress in champagne, bias cut, bare back, minimalist gold chain, Saint Laurent mood",
    "one-shoulder asymmetric midi dress in black crepe, architectural draping, Valentino aesthetic",
    "column dress in dove grey silk, high slit, clean lines, no embellishment, Jil Sander",
    "halter-neck gown in midnight navy, open back, floor-length, Tom Ford elegance",
    "fitted knit midi dress in camel, second-skin fit, turtleneck, cashmere blend, Khaite style",
  ],
  editorial_cool: [
    "oversized white poplin shirt tucked into leather pencil skirt, sleeves rolled, Peter Do aesthetic",
    "deconstructed trench coat in khaki, worn as dress, belted, Maison Margiela vibe",
    "cropped cashmere sweater in cream with high-waist wide silk trousers in black, The Row",
    "leather bomber jacket over silk slip dress, contrast textures, Phoebe Philo aesthetic",
    "tailored bermuda shorts in grey flannel, oversized blazer, loafers, Brunello Cucinelli resort",
  ],
  luxe_casual: [
    "oversized cashmere hoodie in heather grey, tailored joggers, minimalist sneakers, Loro Piana sport",
    "white linen oversized shirt, rolled sleeves, high-waist cream trousers, barefoot luxury, Totême",
    "silk bomber jacket in olive, white tank top, wide-leg chinos, Zegna resort style",
    "cropped boxy tee in white, high-waist pleated trousers in camel, Lemaire relaxed chic",
    "fine-knit polo in navy, tailored linen shorts, leather sandals, Brunello Cucinelli summer",
  ],
  evening_luxe: [
    "black tuxedo jumpsuit, deep V neckline, satin lapels, statement earrings, Saint Laurent night",
    "sequin column dress in gunmetal, long sleeves, high neck, understated glamour, Valentino 2026",
    "velvet blazer dress in deep burgundy, mini length, no embellishment, Tom Ford after-dark",
    "backless silk gown in emerald, cowl neck, minimal jewelry, old Hollywood meets modern Gucci",
    "metallic mesh top over black bandeau, high-waist satin trousers, Balmain club luxe",
  ],
  business_luxe: [
    "tailored grey wool suit, single-breasted, slim lapels, white silk blouse, Dior professional",
    "navy pencil dress, boat neckline, three-quarter sleeves, subtle gold belt, Carolina Herrera",
    "cream blazer with matching wide-leg trousers, cognac leather belt, Celine boardroom",
    "black cashmere turtleneck, high-waist tailored trousers, camel coat on shoulders, The Row CEO",
    "pinstripe vest over white shirt, matching cigarette pants, Armani power dressing 2026",
  ],
};

function getRandomGarment(): string {
  const categories = Object.keys(WARDROBE_2026);
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const items = WARDROBE_2026[cat];
  return items[Math.floor(Math.random() * items.length)];
}

function buildPrompt(stylePrompt: string, isPremium: boolean, customPrompt: string): string {
  const garment = getRandomGarment();

  return `You are editing the uploaded photo. This is an IMAGE EDITING task.

━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULE: CLONE THE PERSON
━━━━━━━━━━━━━━━━━━━━

The uploaded photo is the ONLY identity reference. You must CLONE this person exactly.

FACE — PIXEL-PERFECT COPY:
• Exact skull shape, exact jawline, exact chin.
• Exact nose — same bridge width, same tip shape, same nostrils.
• Exact eyes — same spacing, same eyelid shape, same iris color.
• Exact eyebrows — same thickness, same arch.
• Exact lips — same width, same fullness ratio.
• Exact skin — same texture, same pores, same blemishes, same tone.
• Same age. Same ethnicity. ZERO beautification.

HAIR — EXACT COPY:
• EXACT same length as in the photo. If short — keep short. If bob — keep bob. If long — keep long.
• EXACT same texture — straight stays straight, curly stays curly.
• EXACT same color and highlights.
• Do NOT add volume. Do NOT lengthen. Do NOT change style.
• Hair must look identical to the reference photo.

BODY — ZERO CHANGES:
• Exact same weight and proportions.
• Do NOT slim down. Do NOT add weight. Do NOT reshape.
• Same shoulder width. Same hip width. Same everything.
• The silhouette must match the reference exactly.

IF IN DOUBT → COPY THE PHOTO MORE LITERALLY.

━━━━━━━━━━━━━━━━━━━━
STYLE DIRECTION
━━━━━━━━━━━━━━━━━━━━
${stylePrompt || "Luxury editorial fashion portrait"}

━━━━━━━━━━━━━━━━━━━━
WARDROBE — 2026 LUXURY
━━━━━━━━━━━━━━━━━━━━
${garment}

WARDROBE RULES:
• Modern 2026 luxury fashion ONLY. Think: The Row, Bottega Veneta, Celine, Loro Piana, Saint Laurent.
• Clean lines, perfect tailoring, premium fabrics (cashmere, silk, fine wool, leather).
• NO old-fashioned elements: no bows, no ruffles, no frills, no lace collars.
• NO velvet robes. NO baroque. NO renaissance. NO 1990s silhouettes.
• NO "costume" look. Clothes must look like they belong to this person.
• Garment must fit the person's actual body — not a model's body.

━━━━━━━━━━━━━━━━━━━━
ENERGY & LIFE
━━━━━━━━━━━━━━━━━━━━
• Eyes: bright, alive, sparkling with natural light reflection.
• Skin: luminous, dewy, healthy glow — like real skin in golden hour light.
• Expression: confident, magnetic, natural micro-smile or composed strength.
• The photo must feel ALIVE — like the person is actually there, breathing.
• NO wax figure look. NO mannequin energy. NO dead eyes.

━━━━━━━━━━━━━━━━━━━━
CAMERA & LIGHTING
━━━━━━━━━━━━━━━━━━━━
Shot on 85mm f/1.4 lens. Shallow depth of field.
RAW photography look — natural grain (ISO 200-400), no digital smoothing.
Sculpted directional lighting with soft rim light.
Golden hour warmth or sophisticated studio key light.
Real catchlights in eyes.
NO flat flash. NO HDR. NO AI plastic sheen.

━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT
━━━━━━━━━━━━━━━━━━━━
Luxury real-world location: penthouse, art gallery, European terrace, luxury hotel lobby, or high-end street.
Real architectural depth. Natural light interaction.
NO CGI void. NO plain studio background.

${isPremium ? `
━━━━━━━━━━━━━━━━━━━━
PREMIUM QUALITY
━━━━━━━━━━━━━━━━━━━━
• Micro-detail: individual eyelashes, skin pores, fabric weave visible.
• Advanced shadow sculpting on face.
• Rich tonal range — deep blacks, creamy highlights.
• Film-like color grading (Kodak Portra 400 aesthetic).
` : ""}

${customPrompt ? `
ADDITIONAL DIRECTION:
${customPrompt}
` : ""}

━━━━━━━━━━━━━━━━━━━━
NEGATIVE LIST (NEVER DO)
━━━━━━━━━━━━━━━━━━━━
different person, face change, age change, weight change, hair length change, hair volume change,
body reshaping, slimming, beautification, AI smoothing, plastic skin, wax look, mannequin,
old-fashioned clothes, bows, ruffles, velvet robes, baroque style, renaissance costume,
cartoon, CGI, illustration, watermark, text, logo, blurry, low quality.

OUTPUT: One photorealistic editorial photograph. Ultra high quality. Strictly photorealistic.`;
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

    const { imageBase64, stylePrompt, isPremium, customPrompt } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullPrompt = buildPrompt(stylePrompt || "", isPremium || false, customPrompt || "");

    console.log("Calling Lovable AI Gateway with model google/gemini-3-pro-image-preview");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
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
      console.error("AI Gateway error:", response.status, errorText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let generatedImageUrl: string | null = null;

    const choice = data?.choices?.[0];

    // Format 1: images array
    if (choice?.message?.images?.[0]?.image_url?.url) {
      generatedImageUrl = choice.message.images[0].image_url.url;
    }

    // Format 2: content array with image_url
    if (!generatedImageUrl && Array.isArray(choice?.message?.content)) {
      const imagePart = choice.message.content.find(
        (part: any) => part.type === "image_url"
      );
      if (imagePart?.image_url?.url) {
        generatedImageUrl = imagePart.image_url.url;
      }
    }

    if (!generatedImageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 1000));
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
    console.error("generate-photo error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

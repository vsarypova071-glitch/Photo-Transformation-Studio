import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 2026 luxury fashion — modern, stylish, NO old-fashioned elements
const GARMENT_CATEGORIES = {
  power_chic: [
    "sleek oversized blazer in soft beige with rolled sleeves over a silky camisole, effortlessly chic",
    "tailored cropped blazer in off-white with open front, high-waisted wide-leg trousers",
    "deconstructed asymmetric blazer in dove grey, one shoulder slightly dropped, modern edge",
    "double-breasted blazer dress in caramel, belted at waist, bare legs, power feminine",
    "relaxed-fit ivory suit with slightly oversized jacket, no shirt underneath, confident and clean",
  ],
  modern_elegant: [
    "slip dress in liquid champagne satin, thin straps, low back, minimalist luxury",
    "one-shoulder midi dress in rich chocolate brown with subtle draping",
    "fitted knit midi dress in cream with side slit, showing collarbone and shoulders",
    "halter-neck silk top in ivory tucked into high-waisted tailored black trousers",
    "open-back maxi dress in soft sage green, flowing fabric, effortless movement",
  ],
  editorial_cool: [
    "oversized white cotton shirt partially unbuttoned tucked into leather shorts, modern editorial",
    "structured crop top in black paired with high-waisted palazzo pants in sand",
    "minimalist bodysuit in nude tone with tailored wide-leg trousers in charcoal",
    "off-shoulder knit sweater in soft camel, asymmetric neckline, relaxed luxury",
    "sleeveless turtleneck in ribbed cream cashmere with leather belt at waist",
  ],
  summer_luxury: [
    "lightweight linen co-ord set in warm terracotta — cropped shirt and relaxed trousers",
    "flowing silk maxi skirt in ocean blue with simple white tank top, resort luxury",
    "cotton wrap top in white with high-waisted linen trousers in natural beige",
    "sleek jumpsuit in soft olive with thin belt, open neckline, summer power",
    "draped one-shoulder top in peach silk with wide-leg cream pants, golden hour vibes",
  ],
  evening_modern: [
    "sleek column dress in black with high slit and clean neckline, no embellishments",
    "backless silk dress in deep burgundy, floor-length, minimal and stunning",
    "tailored tuxedo jumpsuit in midnight navy, plunging neckline, sharp shoulders",
    "asymmetric one-shoulder gown in emerald, modern cut, no beading or sequins",
    "fitted velvet midi dress in deep wine, square neckline, sleek and powerful",
  ],
  casual_luxe: [
    "cashmere V-neck sweater in oatmeal over silk slip skirt in champagne",
    "white T-shirt in premium cotton tucked into high-waisted cream trousers, gold jewelry",
    "oversized camel coat worn over simple black dress, street-style editorial",
    "leather jacket in butter-soft tan over white midi dress, modern cool",
    "denim shirt in dark indigo, sleeves rolled, with tailored white trousers",
  ],
};

function getRandomGarment() {
  const categories = Object.keys(GARMENT_CATEGORIES) as (keyof typeof GARMENT_CATEGORIES)[];
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const items = GARMENT_CATEGORIES[cat];
  return items[Math.floor(Math.random() * items.length)];
}

function buildPrompt(styleKeywords: string, isPremium: boolean) {
  const garment = getRandomGarment();

  return `
TASK: Edit this photo to create a luxury fashion portrait. You are EDITING the uploaded photo — NOT creating a new person.

████████████████████████████████████████
██  ABSOLUTE RULE: COPY THE PERSON    ██
████████████████████████████████████████

STUDY the uploaded reference photo carefully. Every detail of the person's appearance must be COPIED EXACTLY.

FACE — PIXEL-PERFECT CLONE:
- The output face IS the input face. Not similar. IDENTICAL.
- Clone EXACT bone structure, jaw, chin, cheekbones.
- Clone EXACT nose shape, bridge, tip, nostrils.
- Clone EXACT eyes: shape, size, spacing, color, iris pattern.
- Clone EXACT eyebrows, lips, skin tone, texture, all marks/moles/freckles.
- Clone EXACT age — not one year younger or older. If the person looks 25, output looks 25. If 45, output looks 45.
- The face must pass facial recognition as the SAME person.

BODY — ZERO CHANGES:
- COPY the person's EXACT body type, weight, proportions from the reference.
- Do NOT add fullness, curves, or volume to the body.
- Do NOT make slimmer OR heavier. EXACT same silhouette.
- Do NOT change height, shoulder width, or any physical dimension.
- The body in the output must be INDISTINGUISHABLE from the reference photo body.

HAIR — EXACT COPY:
- COPY the EXACT hair length from the reference photo. If it's short, keep it short. If long, keep it long.
- COPY exact color, texture (straight/wavy/curly), density, parting.
- Do NOT shorten OR lengthen the hair by even 1 centimeter.
- Do NOT add volume, thickness, or change the hairstyle.
- Only subtle grooming — as if the person's own hair was styled by a professional for 5 minutes, nothing more.

HAIR — EXACT COPY (already defined above, reinforcing):
- The hair in the output MUST match the reference photo length exactly.
- Natural shine and movement. No synthetic or plastic look.

ENERGY & MAGNETISM — THIS IS EVERYTHING:
The photo must make people STOP scrolling. The viewer must feel the person's PRESENCE through the screen.
- Eyes that GLOW: sparkling, alive, wet with light, full of intention and confidence. Like the person has a secret.
- Skin that RADIATES: luminous from within, dewy, sun-kissed warmth. You can almost feel the warmth.
- Natural GLOW on cheekbones, nose bridge, collarbone — skin catches light like silk.
- Micro-expressions that SPEAK: the hint of a smile, a knowing look, quiet confidence.
- The person's ENERGY must be palpable — charisma, magnetism, inner fire.
- Hair that MOVES: natural wind-swept strands, light playing through individual hairs.
- Body language of POWER: relaxed but commanding, effortless confidence, high-status presence.
- This is NOT a posed portrait. This is a MOMENT CAPTURED — mid-thought, mid-laugh, mid-life.
- The image must trigger an emotional response in the viewer. INTIMATE and REAL.
- Natural imperfections are ESSENTIAL: a stray hair, skin texture, slight asymmetry — this makes it ALIVE.

████████████████████████████████████████
██  STYLE & MOOD                      ██
████████████████████████████████████████
${styleKeywords}

████████████████████████████████████████
██  WARDROBE — 2026 LUXURY            ██
████████████████████████████████████████
Outfit: ${garment}
- MODERN 2026 fashion ONLY. Clean lines, minimal details, luxurious simplicity.
- NO old-fashioned elements: no pussy bows, no ruffles, no heavy embroidery, no beading, no lace collars, no high-neck blouses with bows.
- NO dated aesthetics: no heavy knits, no frumpy silhouettes, no 1990s catalog looks.
- Think: The Row, Bottega Veneta, Loro Piana, Celine, Max Mara — quiet luxury, modern power.
- Fabric must look TOUCHABLE: visible texture, weight, quality.
- Colors: neutrals, earth tones, muted jewel tones. No neon, no busy prints.
- Clothing must look naturally WORN, not digitally pasted.

████████████████████████████████████████
██  ENVIRONMENT                       ██
████████████████████████████████████████
- Real physical location matching the style mood.
- Architectural depth with natural light interaction.
- Subtle depth of field — sharp on subject, soft background.
- Environment colors complement the outfit.
- NO flat void. NO impossible AI architecture.

████████████████████████████████████████
██  LIGHTING — PARAMOUNT PRIORITY     ██
████████████████████████████████████████
THIS IS THE MOST IMPORTANT SECTION. The lighting makes the photo REAL or FAKE.
- GOLDEN HOUR warmth: warm directional sunlight creating natural volume on the face.
- Strong 3D VOLUME through light and shadow: deep sculpted shadows under cheekbones, jawline, nose bridge.
- Key light at 30-45 degrees creating dramatic yet natural fall-off across facial planes.
- VISIBLE light source interaction: warm glow on skin facing light, cool shadow on opposite side.
- Subsurface scattering on ears, nose tip, and fingers — light passing THROUGH skin showing blood warmth.
- Rich catch lights in BOTH eyes — irregular, natural reflections (windows, sky), NOT perfect circles.
- Rim/hair light creating luminous edge separation from background — backlit glow effect.
- Ambient bounce light filling shadows softly — NOT black crushed shadows.
- Color temperature variation: warm highlights, slightly cooler shadows — just like real photography.
- NO flat even lighting. NO shadowless faces. NO artificial studio feel.
- Light must WRAP around the face showing its three-dimensional form.
- Environmental light interaction: reflections on surfaces, light pools, dappled patterns.

████████████████████████████████████████
██  CAMERA & REALISM                  ██
████████████████████████████████████████
- 85mm f/1.4 portrait lens. Shallow DOF with creamy natural bokeh.
- RAW unprocessed look — rich dynamic range, NO Instagram filters, NO color grading presets.
- Phase One IQ4 150MP medium format sensor quality.
- REAL PHOTOGRAPH — the viewer must believe a photographer took this on location.
- Visible lens characteristics: natural vignette, subtle chromatic aberration at edges.
- Film-like grain at ISO 400-800 — adds organic texture, prevents AI smoothness.
- THREE-DIMENSIONAL DEPTH: foreground elements slightly soft, subject tack sharp, background with beautiful bokeh circles.
- Color science like Fujifilm or Kodak Portra — rich but natural, warm skin tones.
- NO digital perfection. NO AI smoothness. NO uncanny valley.
- The image must look like it was CAPTURED, not GENERATED.

${isPremium ? `
████████████████████████████████████████
██  PREMIUM ENHANCEMENTS              ██
████████████████████████████████████████
- Individual pore-level skin detail.
- Thread-level fabric texture.
- Cinematic tonal separation in shadows.
- Atmospheric depth particles.
- Hair strand-level rendering.
` : ""}

████████████████████████████████████████
██  NEVER DO THIS                     ██
████████████████████████████████████████
different person, changed face shape, altered bone structure, different nose, different eyes, beautified features, slimmed face, smoothed skin, changed eye color, changed age, made older, made younger, added weight, made heavier, made fuller, added curves, added fullness to body, made thinner, changed body proportions, longer hair, shorter hair, added hair volume, changed hair length, cartoon, CGI, 3D render, anime, illustration, painting, watermark, text, logo, magazine layout, plastic skin, wax figure, lifeless eyes, dead expression, mannequin pose, multiple people, distorted limbs, same outfit repeated.
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

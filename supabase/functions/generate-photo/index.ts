import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 30+ unique outfits grouped by category for maximum variety
const GARMENT_CATEGORIES = {
  blazers: [
    "double-breasted navy blazer in Italian wool with gold buttons",
    "oversized camel blazer in cashmere-wool blend with patch pockets",
    "fitted black tuxedo jacket with satin peak lapels",
    "chalk-stripe charcoal blazer with notch lapels in English wool",
    "cream linen blazer with tortoiseshell buttons, slightly relaxed fit",
  ],
  dresses: [
    "midi wrap dress in emerald silk charmeuse with subtle draping",
    "minimalist black sheath dress with architectural neckline in matte crepe",
    "burgundy A-line dress in heavy duchess satin with hidden pockets",
    "ivory column dress in Japanese crepe with invisible seaming",
    "navy blue cocktail dress with asymmetric hemline in stretch wool",
  ],
  suits: [
    "charcoal pinstripe suit in super 180s wool with slim-cut trousers",
    "all-white linen suit with relaxed blazer and wide-leg trousers",
    "forest green velvet suit with shawl collar for evening",
    "powder blue Italian suit with mother-of-pearl buttons",
    "black three-piece suit in mohair blend with satin-back waistcoat",
  ],
  tops: [
    "cream silk pussy-bow blouse with French cuffs",
    "black cashmere turtleneck, fitted, with visible knit texture",
    "white crisp cotton shirt with spread collar, slightly open",
    "dusty rose draped chiffon blouse with delicate pintucks",
    "striped Breton top in fine-gauge merino, navy and white",
  ],
  outerwear: [
    "camel cashmere overcoat, knee-length, with belt",
    "black leather biker jacket in supple lambskin with silver hardware",
    "dove grey wool cape with oversized collar",
    "olive green trench coat in water-resistant gabardine",
    "faux-fur coat in champagne tone, cropped to waist",
  ],
  evening: [
    "floor-length gown in midnight blue silk with plunging back",
    "sequined cocktail top in gold paired with black cigarette trousers",
    "off-shoulder velvet jumpsuit in deep plum",
    "beaded tulle overlay dress in blush pink",
    "black lace bodysuit under a high-waisted satin pencil skirt",
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

ENERGY & LIFE — THE PHOTO MUST BREATHE:
- The person must look ALIVE — not a mannequin, not a wax figure.
- Natural micro-expressions: slight smile tension, eye sparkle, genuine warmth.
- Skin must show LIFE: visible pores, natural flush, blood flow undertone, warmth in cheeks and nose tip.
- Eyes must have SOUL: multiple catch lights, iris depth, moisture layer, real gaze with intention.
- Skin has VOLUME: subsurface warmth, translucency at thin areas (ears, nostrils, between fingers).
- Natural body tension and weight distribution — a real person in a real moment.
- The photo should feel like a CAPTURED MOMENT by a photographer, not a rendered image.
- Emotional authenticity: confidence, calm power, inner beauty radiating outward.
- Imperfections are WELCOME: a stray hair, slight asymmetry, natural skin texture — these prove it's REAL.

████████████████████████████████████████
██  STYLE & MOOD                      ██
████████████████████████████████████████
${styleKeywords}

████████████████████████████████████████
██  WARDROBE                          ██
████████████████████████████████████████
Outfit: ${garment}
- Visible fabric texture: weave, fiber direction, surface grain.
- Realistic weight and drape: gravity-accurate folds, compression wrinkles.
- Premium materials: cashmere, silk, fine wool, satin, supple leather.
- Clothing must look WORN by this person naturally, not digitally pasted.
- Color must harmonize with the style direction.

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GARMENT_VARIATIONS = [
  "impeccably tailored double-breasted blazer in rich Italian wool with horn buttons and peak lapels",
  "flowing haute couture silk blouse with delicate draping and mother-of-pearl closures",
  "architectural structured dress with geometric seaming in heavy matte crepe",
  "monochrome luxury power suit with subtle pinstripe in super 180s wool",
  "cashmere-blend turtleneck ensemble layered with a camel hair overcoat",
  "avant-garde asymmetrical draped gown in duchesse satin with sculptural shoulder",
  "bespoke linen suit with hand-stitched details and natural shell buttons",
  "layered couture outfit: fine knit under a tailored vest with silk scarf accent",
  "velvet evening blazer with satin shawl collar paired with silk camisole",
  "structured leather trench coat with belt in supple Nappa leather",
  "hand-embroidered organza blouse with high collar and French cuffs",
  "minimalist column dress in Japanese crepe with invisible seaming",
];

function getRandomGarment() {
  return GARMENT_VARIATIONS[Math.floor(Math.random() * GARMENT_VARIATIONS.length)];
}

function buildPrompt(styleKeywords: string, isPremium: boolean) {
  const garment = getRandomGarment();

  return `
TASK: Edit this photo to create a luxury fashion portrait. You are EDITING the uploaded photo — NOT creating a new person.

████████████████████████████████████████
██  RULE #1: THIS IS THE SAME PERSON  ██
████████████████████████████████████████

You are RETOUCHING and RESTYLING the person in the uploaded photo.
Think of it as: this exact person walked into a luxury photo studio, got dressed in high fashion, and was photographed by a top professional.

FACE CLONING — NON-NEGOTIABLE:
- The face in the output IS the face from the input photo. Not similar. Not inspired by. IDENTICAL.
- Clone EXACT bone structure: skull shape, jaw angle, chin prominence, cheekbone position.
- Clone EXACT nose: bridge width, tip shape, nostril flare, length, angle from every view.
- Clone EXACT eyes: shape, size, spacing, lid crease depth, inner/outer corner angles.
- Clone EXACT eye COLOR and iris pattern — do not change even slightly.
- Clone EXACT eyebrows: arch, thickness, spacing, hair growth direction.
- Clone EXACT lips: cupid's bow shape, upper/lower lip ratio, width, natural color.
- Clone EXACT skin: tone, undertone, texture, pores, any moles, freckles, beauty marks.
- Clone EXACT face PROPORTIONS: forehead-to-chin ratio, mid-face width, face shape (round/oval/square).
- Clone EXACT age appearance — not one year younger or older.
- The face must pass facial recognition software as the SAME person.

BODY — DO NOT CHANGE:
- Keep EXACT body proportions, weight, and build from the reference photo.
- Do NOT make the person thinner, heavier, taller, or shorter.
- Do NOT add muscle mass or change body shape in any way.
- The body silhouette must match the original person exactly.

HAIR — SAME BUT GROOMED:
- Keep EXACT hair color, texture (straight/wavy/curly), density, length, parting.
- Do NOT make hair longer or shorter than in the reference photo.
- Do NOT add volume or thickness that isn't in the original.
- Style it beautifully within the existing length — as if groomed for this photoshoot.
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
different person, changed face shape, altered bone structure, different nose, different eyes, beautified features, slimmed face, smoothed skin, changed eye color, changed age, made older, made younger, added weight, made heavier, made thinner, changed body proportions, longer hair, shorter hair, added hair volume, cartoon, CGI, 3D render, anime, illustration, painting, watermark, text, logo, magazine layout, plastic skin, wax figure, lifeless eyes, dead expression, mannequin pose, multiple people, distorted limbs.
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

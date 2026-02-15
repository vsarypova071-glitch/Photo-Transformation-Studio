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
You are a world-renowned luxury fashion photographer shooting a campaign for Vogue or Harper's Bazaar.

═══════════════════════════════════════
ABSOLUTE PRIORITY #1: IDENTITY LOCK
═══════════════════════════════════════
The uploaded photo is the ONLY identity reference. The generated image MUST depict the EXACT SAME PERSON.
- Copy the precise facial bone structure: cheekbones, jawline, chin shape, forehead proportions.
- Replicate exact nose geometry: bridge width, tip shape, nostril form.
- Match eye shape, spacing, eyelid crease depth, iris color.
- Preserve lip shape, thickness, and proportions exactly.
- Keep exact skin tone, undertone, and any natural skin texture (pores, freckles, marks).
- Maintain the person's apparent age — no younger, no older.
- Hair color, texture, and density must match the reference.
- NO beautification. NO face slimming. NO skin smoothing. NO idealization.
- The person must be INSTANTLY recognizable by their friends and family.
- If identity accuracy conflicts with style, IDENTITY ALWAYS WINS.

═══════════════════════════════════════
STYLE & MOOD DIRECTION
═══════════════════════════════════════
${styleKeywords}

═══════════════════════════════════════
WARDROBE (must look like real physical clothing)
═══════════════════════════════════════
Outfit: ${garment}
- Every garment must have visible FABRIC TEXTURE: weave pattern, fiber direction, surface grain.
- Show realistic fabric WEIGHT: heavy fabrics drape differently than light ones.
- Natural fold physics: gravity-accurate creasing, compression wrinkles at joints, tension lines.
- Visible construction details: real buttonholes, stitching lines, lapel roll, collar stand.
- Materials must read as PREMIUM: cashmere, silk, fine wool, structured satin, supple leather, organza.
- Color palette of clothing must harmonize with the style direction above.
- NO synthetic sheen. NO plastic-looking fabric. NO costume-quality garments.
- Clothing must look like it was ACTUALLY WORN by this person, not digitally pasted on.

═══════════════════════════════════════
ENVIRONMENT & BACKGROUND (must match the style)
═══════════════════════════════════════
- Background must be a REAL physical environment that matches the style direction.
- Architectural elements with depth: real walls, columns, windows, furniture, natural scenery.
- Light in the environment must interact naturally with surfaces (reflections, ambient occlusion, color bounce).
- Background should have subtle depth of field — sharp on subject, gently soft behind.
- Environment color palette must COMPLEMENT the outfit and style mood.
- Examples of matching environments: marble hotel lobby for Business Elite, Parisian café terrace for Parisian Chic, minimalist Scandinavian interior for Scandinavian Minimal, lush garden for Resort style.
- NO flat studio void. NO obviously AI-generated impossible architecture. NO floating elements.

═══════════════════════════════════════
LIGHTING (cinematic editorial quality)
═══════════════════════════════════════
- Primary directional key light creating dimensional facial modeling.
- Controlled shadow falloff across cheekbones and jawline for sculpted look.
- Soft rim/hair light separating subject from background.
- Natural skin luminosity — light penetrating skin surface slightly (subsurface scattering).
- Catch lights in eyes must be present and natural.
- Balanced highlight roll-off — no blown whites, no crushed blacks.
- Light must match the environment (warm for interiors, cool for outdoor shade, golden for sunset).
- NO flat on-camera flash. NO uniform shadowless lighting. NO HDR overprocessing.

═══════════════════════════════════════
COMPOSITION & POSE
═══════════════════════════════════════
- Magazine-cover-worthy composition with intentional framing.
- Confident, high-status body language — natural but powerful.
- Pose must feel organic, not stiff or stock-photo-like.
- Framing: portrait or 3/4 body, subject as clear focal point.
- Rule of thirds or centered symmetrical composition.
- The image must work as an Instagram post AND as a profile picture crop.

═══════════════════════════════════════
TECHNICAL CAMERA SETTINGS
═══════════════════════════════════════
- Shot on 85mm f/1.4 or 135mm f/2 portrait lens.
- Shallow depth of field with creamy bokeh.
- RAW photography look with rich dynamic range.
- Professional color grading matching the style mood.
- Resolution and detail level of a Phase One medium format camera.
- Strictly photorealistic — must be indistinguishable from a real photograph.

${isPremium ? `
═══════════════════════════════════════
PREMIUM ENHANCEMENTS
═══════════════════════════════════════
- Micro-detail skin rendering: individual pores, fine facial hair visible.
- Advanced fabric micro-texture: thread-level detail on close inspection.
- Cinematic color grading with tonal separation in shadows.
- Atmospheric depth: subtle haze or light particles in background.
- Hair strand-level detail with natural light interaction.
- Jewelry or accessories with realistic metallic reflections.
` : ""}

═══════════════════════════════════════
ABSOLUTE NEGATIVE LIST (never include)
═══════════════════════════════════════
different person, altered face, beautified proportions, smoothed skin, cartoon, CGI, 3D render, anime, illustration, painting, watercolor, sketch, low resolution, blurry, noisy, watermark, text, typography, logo, magazine layout, graphic overlay, border, frame, collage, split image, multiple people, hands with wrong finger count, distorted limbs, uncanny valley, plastic doll skin, oversaturated colors, HDR artifacts.
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

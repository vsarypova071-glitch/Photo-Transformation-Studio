// deno-lint-ignore-file

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit in deep navy",
  "bespoke structured blazer in forest green premium cashmere",
  "silk blouse in ivory with high-waist charcoal trousers",
  "architectural couture coat in camel",
  "luxury power suit in slate gray, precision tailoring",
  "oversized cashmere coat in off-white, The Row aesthetic",
  "structured leather blazer in cognac brown",
  "silk midi dress in deep burgundy with architectural draping",
  "wide-leg trousers in charcoal with ivory cashmere turtleneck",
  "blazer dress in midnight blue, sharp structured shoulders",
];

function getRandomGarment(exclude: string[] = []): string {
  const available = WARDROBE.filter(g => !exclude.includes(g));
  return available[Math.floor(Math.random() * available.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, aspectRatio?: string, garment?: string): string {
  const g = garment || getRandomGarment();

  return `TASK: Take the face from the input photo and place it into a new professional fashion photograph.

Think of it like a skilled film compositor: the face is a LAYER that gets composited into a completely new scene. The face layer is UNTOUCHED. Only the scene changes.

═══════════════════════════════════════
STEP 1: SCAN THE FACE — MEMORIZE EVERY DETAIL
═══════════════════════════════════════

Look at the face in the input photo. Read it like a forensic artist:

EYES — look with extreme precision:
→ EXACT iris color (not "green" — is it sage? grey-green? olive-hazel? warm amber-green?)
→ Eye spacing: narrow-set / average / wide-set — THIS IS BONE, CANNOT CHANGE
→ Eyelid shape: heavy lid / visible crease / deep-set / almond
→ Natural lash density: sparse / medium — DO NOT add theatrical fake lashes
→ CATCHLIGHTS: the eyes MUST have a soft round specular highlight (catchlight) in each iris
  — This is the single point of light reflected from the studio octabox
  — Position: upper-left or upper-right of the iris, round, small, luminous
  — WITHOUT catchlights the eyes look dead. WITH catchlights they come ALIVE.
→ EYE MOISTURE: the sclera (whites) must have subtle wet sheen — not bloodshot, just alive
→ GAZE QUALITY — this is the soul of the portrait:
  • The gaze must be SOFT AND MAGNETIC — not hard staring, not vacant
  • Think: a person lost in a beautiful thought, slightly dreamy, with quiet inner confidence
  • Eyes slightly relaxed — NOT wide-open in tension, NOT squinting in aggression
  • Slight downward tilt of the gaze (5°) creates intimacy and depth
  • The feeling: "she sees you, but she's also somewhere else" — mysterious, captivating
  • ⛔ DO NOT make "passport photo" dead eyes
  • ⛔ DO NOT make hard aggressive stare
  • ✓ DO create that golden-hour softness in the gaze — warm, alive, pulling you in

CHEEKS — most important:
→ Are the cheeks HOLLOW (sunken below the cheekbone) or FULL (rounded)?
→ If hollow: there must be a VISIBLE SHADOW beneath the cheekbone in the result
→ ⛔ DO NOT fill in hollow cheeks with fat or volume — this changes the person completely

NOSE:
→ Bridge: narrow / medium / wide?
→ Tip: rounded / pointed / upturned?

JAW & CHIN:
→ Soft and rounded OR defined and angular?
→ Chin: short / medium / long?

LIPS:
→ Natural shape: thin / medium / full?
→ Natural lip color (warm rose / berry / nude)?

SKIN:
→ Exact skin tone undertone
→ Age — do NOT change it
→ Any moles, freckles, asymmetries — reproduce ALL of them

HAIR:
→ Exact color (platinum / ash blonde / brunette / etc.)
→ Exact cut — DO NOT change the hairstyle

═══════════════════════════════════════
STEP 2: LOCK THE FACE — IT CANNOT BE MODIFIED
═══════════════════════════════════════

The face you just scanned is FINAL. It cannot be altered for ANY reason.

⛔ DO NOT de-age or make younger
⛔ DO NOT slim or reshape the face
⛔ DO NOT widen or narrow the eyes
⛔ DO NOT change eye color even by one shade
⛔ DO NOT add volume to hollow cheeks
⛔ DO NOT add fake heavy lashes — only enhance what is naturally there
⛔ DO NOT change the nose
⛔ DO NOT inject the lips — keep natural shape
⛔ DO NOT apply "beauty filter" — this is a real person, not an AI model

This person is beautiful EXACTLY AS THEY ARE. Your job is NOT to improve them. Your job is to photograph them beautifully.

═══════════════════════════════════════
STEP 3: BUILD THE NEW SCENE AROUND THE FACE
═══════════════════════════════════════

Now place that EXACT LOCKED FACE into a completely new professional setting:

OUTFIT: ${g}

BACKGROUND: Luxury studio — warm gray / ivory / soft taupe
⚠️ MANDATORY: Background color MUST contrast with outfit color. They cannot be similar tones.

LIGHTING:
• Large octabox at 45° — sculpts the face, REVEALS cheekbone structure, does NOT flatten it
• Rim/hair light — creates depth and separation from background
• Minimal fill — cheek hollows MUST remain visible if they exist
• Sharp catchlights in each eye

POSE: Confident editorial pose — hand near face, slight head turn, strong gaze
CAMERA: 85mm f/2.0 — sharp face, creamy background bokeh
FILM: Kodak Portra 800 — warm, dimensional, rich skin tones

MAKEUP: Professional and flattering for THIS person's specific skin tone
• Skin: natural texture, real skin — NOT plastic or airbrushed to oblivion
• Lips: warm nude / mauve / berry — ⛔ NEVER matching the outfit color
• Lashes: enhanced naturally — ⛔ NO theatrical fake lashes
• Blush: placed high on cheekbones, warm

${aspectRatio ? `Aspect ratio: ${aspectRatio}` : ""}
${stylePrompt ? `Style: ${stylePrompt}` : ""}
${customPrompt ? `Note: ${customPrompt}` : ""}

═══════════════════════════════════════
STEP 4: FINAL CHECK BEFORE RENDERING
═══════════════════════════════════════

Look at your result and compare with the source photo:

• Same eye color? Same eye spacing? → If NO — fix it
• Same nose shape? → If NO — fix it
• Same cheek structure (hollow stays hollow, full stays full)? → If NO — fix it
• Same jaw and chin? → If NO — fix it
• Same hair cut and color? → If NO — fix it
• Same age? → If NO — fix it
• No heavy fake lashes if source was natural? → If NO — fix it
• Outfit and background are clearly different colors? → If NO — fix it

Would a close friend of this person recognize them immediately? → If NO — rebuild the face from scratch.

ONLY render when all answers are YES.`;
}

async function generateSingle(
  imageBase64: string,
  stylePrompt: string,
  customPrompt: string,
  aspectRatio: string | undefined,
  garment: string
): Promise<string | null> {
  const fullPrompt = buildPrompt(stylePrompt, customPrompt, aspectRatio, garment);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
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
    console.error(`AI error ${response.status}:`, errText.substring(0, 300));
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, stylePrompt, customPrompt, originalDimensions, count = 3 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aspectRatio: string | undefined;
    if (originalDimensions?.width && originalDimensions?.height) {
      const w = originalDimensions.width;
      const h = originalDimensions.height;
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(w, h);
      aspectRatio = `${w / divisor}:${h / divisor} (${w}x${h} pixels)`;
    }

    const numVariants = Math.min(Math.max(1, count), 3);

    const garments: string[] = [];
    for (let i = 0; i < numVariants; i++) {
      garments.push(getRandomGarment(garments));
    }

    console.log(`Generating ${numVariants} variants in parallel...`);

    const promises = garments.map(g =>
      generateSingle(imageBase64, stylePrompt || "", customPrompt || "", aspectRatio, g)
    );

    const results = await Promise.all(promises);
    const imageUrls = results.filter(Boolean) as string[];

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No images returned from AI model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated ${imageUrls.length}/${numVariants} variants successfully`);

    return new Response(
      JSON.stringify({ imageUrl: imageUrls[0], imageUrls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Edge function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

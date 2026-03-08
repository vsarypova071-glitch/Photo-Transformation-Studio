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

  return `You are a forensic portrait compositor. Your task: place THIS EXACT FACE into a new fashion scene.
The face is a locked asset. Only the environment changes.

PRIORITY ORDER (strict):
1. GEOMETRY LOCK — face proportions, jaw width, chin shape → ABSOLUTE PRIORITY
2. IDENTITY LOCK — eyes, nose, lips, skin texture → PRESERVE EXACTLY
3. STYLE — outfit, background, lighting → CREATIVE FREEDOM ONLY HERE

══════════════════════════════════════════════════
PHASE 1: GEOMETRY SCAN (face as biometric data)
══════════════════════════════════════════════════

Before doing anything else, extract and record these measurements from the source photo:

[FACE GEOMETRY — LOCK ALL VALUES]

▸ FACE OVAL:
  → Total face width (ear to ear at widest point)
  → Face width at temple level
  → Face width at cheekbone level
  → Face width at jawline level ← MOST CRITICAL
  → Face width-to-height ratio

▸ JAW GEOMETRY (⚠️ PRIMARY DRIFT ZONE — AI slims jaw by default 15–25%):
  → Jaw width (L jaw corner to R jaw corner) — measure in source, LOCK THIS NUMBER
  → Jaw width / IPD ratio — record exact ratio, result MUST be identical
  → Jaw angle: where jaw meets neck — COPY EXACTLY
  → Jaw shape: square / tapered / round — COPY EXACTLY, DO NOT TAPER
  → ⛔ FORBIDDEN: creating V-shape where source has flat/round jaw

▸ CHIN GEOMETRY:
  → Chin width — MEASURE AND LOCK
  → Chin shape: rounded / square / soft-square / slightly-pointed — COPY EXACTLY
  → ⛔ If source chin is ROUNDED or SQUARE → result MUST be ROUNDED or SQUARE
  → ⛔ FORBIDDEN: converting rounded/soft chin to pointed/sharp chin

▸ CHEEK VOLUME:
  → Volume level: hollow / medium / full — COPY EXACTLY
  → Cheekbone prominence: subtle / medium / pronounced
  → ⛔ DO NOT reduce cheek volume if source has full cheeks
  → ⛔ DO NOT add volume if source has hollow cheeks

▸ LOWER THIRD PROPORTIONS (nose base → chin tip):
  → Width ratio at jawline vs cheekbones
  → ⛔ If source lower third is wide → result MUST be wide. No tapering.

[RECORD ALL VALUES ABOVE BEFORE GENERATING]

══════════════════════════════════════════════════
PHASE 2: IDENTITY SCAN (face as person)
══════════════════════════════════════════════════

▸ EYES (⚠️ CRITICAL DRIFT ZONE — AI alters eyes by default):
  → Iris color: record EXACT HEX-like description (e.g. "warm amber-hazel with dark limbal ring",
    "cool grey-green with brown flecks") — result MUST match this EXACTLY
  → Eye spacing: measure inter-canthus distance / IPD ratio — LOCK THIS, it is bone structure
  → Outer canthus angle: measure tilt in degrees (up / horizontal / slightly down) — LOCK EXACTLY
    ⛔ FORBIDDEN: lifting outer corner, creating cat-eye or fox-eye tilt
  → Eyelid crease: mono / single fold / double fold / hooded — COPY EXACTLY
  → Eye shape type: almond / round / hooded / deep-set / prominent — COPY EXACTLY
    ⛔ FORBIDDEN: converting round to almond, hooded to open, or any shape change
  → Eye width (horizontal aperture): measure and lock
  → Sclera tone: pure white / warm white / slightly veined — COPY, no whitening
  → Natural lash density — DO NOT add theatrical lashes, DO NOT extend
  → Brow shape: arch type, thickness, distance above eye — COPY EXACTLY
  → CATCHLIGHTS: round specular highlight in each iris, upper quadrant — MANDATORY for life-like gaze
  → EYE MOISTURE: subtle wet sheen on sclera — alive, NOT bloodshot, NOT dry
  → GAZE: soft and magnetic, slightly dreamy, 5° downward tilt — NOT passport stare
  → ⛔ ABSOLUTE RULES FOR EYES:
    - DO NOT change iris color under ANY lighting condition
    - DO NOT lift or lower outer canthus angle
    - DO NOT change inter-eye distance
    - DO NOT add double fold if source is mono-lid
    - DO NOT elongate or widen eye aperture
    - DO NOT "beautify" eyes — preserve every asymmetry from source

▸ NOSE:
  → Bridge width: narrow / medium / wide
  → Tip shape: rounded / pointed / bulbous / upturned
  → ⛔ DO NOT refine, narrow or alter nose shape

▸ LIPS:
  → Fullness: thin / medium / full
  → Shape: defined cupid's bow / soft / straight upper lip
  → ⛔ DO NOT enlarge or reshape

▸ SKIN:
  → Tone: note undertone (warm / cool / neutral)
  → Texture: real skin — pores, natural variation
  → ⛔ NO airbrushing, NO plastic skin, NO beauty filter texture

══════════════════════════════════════════════════
⛔ NEGATIVE PROMPT — STRICTLY FORBIDDEN
══════════════════════════════════════════════════

GEOMETRY FORBIDDEN:
slim face, narrow jaw, v-shape face, v-shape jaw, narrow lower face, tapering jaw,
face slimming, jawline contouring, chiseled jaw, sculpted jaw, defined jawline,
pointed chin, sharp chin, narrow chin, V-chin, narrowed lower third, compressed jaw width,
reduced chin width, face restructuring, altered facial structure, narrowed face,
thinner face, supermodel jaw, editorial jaw proportions, fashion face geometry

IDENTITY FORBIDDEN:
model face, beautified face, idealized face, perfect skin, airbrushed skin,
beauty filter face, beautification filter, perfect oval face, supermodel proportions,
slimmed cheeks (if source has full), filled cheeks (if source has hollow)

══════════════════════════════════════════════════
PHASE 3: BUILD SCENE (creative freedom only here)
══════════════════════════════════════════════════

Place the EXACT LOCKED FACE into a new professional setting:

OUTFIT: ${g}

BACKGROUND: Luxury studio — warm gray / ivory / soft taupe
⚠️ MANDATORY: Background MUST contrast with outfit — not similar tones

LIGHTING:
• Large octabox 45° — sculpts without flattening
• Rim/hair light — depth, separation from background
• Minimal fill — preserve natural shadows under cheekbones
• CATCHLIGHTS (mandatory): round specular in each iris, upper quadrant
• Eye zone slightly brighter — draws viewer into gaze

POSE: Confident editorial — hand near face, slight head turn, magnetic soft gaze
CAMERA: 85mm f/2.0 — eye-level only, neutral perspective, zero distortion
⚠️ Forbidden: wide-angle (widens & distorts), low-angle (sharpens chin), any extreme angle
FILM: Kodak Portra 800 — warm, dimensional, natural skin tones

MAKEUP: Flattering for this specific skin tone
• Skin: real texture — NOT plastic or airbrushed
• Lips: warm nude / mauve / berry — ⛔ NEVER match outfit
• Lashes: naturally enhanced — ⛔ NO theatrical lashes
• Blush: high on cheekbones, warm tone

${aspectRatio ? `Aspect ratio: ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional note: ${customPrompt}` : ""}

══════════════════════════════════════════════════
PHASE 4: DUAL VERIFICATION (geometry + identity)
══════════════════════════════════════════════════

Run both checks before rendering:

[GEOMETRY CHECK — measure and compare]:
□ JAW WIDTH RATIO (jaw/IPD): result === source? → FAIL if narrower → REBUILD lower face
□ LOWER THIRD WIDTH: result === source? → FAIL if tapered → REBUILD
□ CHIN SHAPE: same type (rounded/square/soft)? → FAIL if sharper → FIX
□ CHIN WIDTH: same width? → FAIL if narrower → FIX
□ CHEEK VOLUME: same level? → FAIL if deflated or inflated → FIX
□ JAW SHAPE: flat/round jaw in source = flat/round jaw in result? → FAIL if V-shaped → REBUILD
□ CAMERA: eye-level? 85mm? → FAIL if low-angle or wide → FIX

[IDENTITY CHECK — visual comparison]:
□ Eye color: exact match? → FAIL → fix
□ Eye spacing: same? → FAIL → fix
□ Nose shape: same? → FAIL → fix
□ Skin tone: same undertone? → FAIL → fix
□ Age: same? → FAIL → fix
□ Hair: same cut & color? → FAIL → fix
□ Catchlights: visible in each eye? → FAIL → fix
□ Gaze: soft, magnetic, dreamy? → FAIL → fix

[IDENTITY RECOGNITION TEST]:
Would a person who knows this individual recognize them from the result?
→ YES = render. → NO = rebuild face from Phase 1.

⚠️ ANTI-SLIM PROTOCOL:
AI models have a systematic bias to narrow lower faces. Counter this:
ACTIVELY widen the lower third by 10-15% compared to your initial render impulse.
Then compare with source. Adjust until jaw width matches source exactly.

ONLY render when ALL checks pass.`;
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

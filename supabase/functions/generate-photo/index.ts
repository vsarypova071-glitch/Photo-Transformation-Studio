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

// 🔥 TIMEOUT FETCH (фикс зависаний)
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 60000 // 60 сек
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    console.error("Fetch timeout or error:", err);
    throw new Error("AI request timeout");
  } finally {
    clearTimeout(id);
  }
}

function buildPrompt(
  stylePrompt: string,
  customPrompt: string,
  aspectRatio?: string,
  garment?: string
): string {
  const g = garment || getRandomGarment();

  return `You are a forensic portrait compositor...
OUTFIT: ${g}

${aspectRatio ? `Aspect ratio: ${aspectRatio}` : ""}
${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional note: ${customPrompt}` : ""}`;
}

// 🔥 ОДНА генерация
async function generateSingle(
  imageBase64: string,
  stylePrompt: string,
  customPrompt: string,
  aspectRatio: string | undefined,
  garment: string
): Promise<string> {
  const fullPrompt = buildPrompt(stylePrompt, customPrompt, aspectRatio, garment);

  const response = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
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
    },
    60000 // таймаут
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`AI error ${response.status}:`, errText.substring(0, 300));
    throw new Error(`AI error ${response.status}`);
  }

  const data = await response.json();

  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!url) {
    throw new Error("No image returned from AI");
  }

  return url;
}

// 🔥 ОСНОВНАЯ ФУНКЦИЯ
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const MAX_TIME = 120000; // 2 минуты

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service not configured");
    }

    const {
      imageBase64,
      stylePrompt,
      customPrompt,
      originalDimensions,
      count = 3,
    } = await req.json();

    if (!imageBase64) {
      throw new Error("Image not provided");
    }

    let aspectRatio: string | undefined;

    if (originalDimensions?.width && originalDimensions?.height) {
      const w = originalDimensions.width;
      const h = originalDimensions.height;

      const gcd = (a: number, b: number): number =>
        b === 0 ? a : gcd(b, a % b);

      const divisor = gcd(w, h);
      aspectRatio = `${w / divisor}:${h / divisor}`;
    }

    const numVariants = Math.min(Math.max(1, count), 3);

    const garments: string[] = [];
    for (let i = 0; i < numVariants; i++) {
      garments.push(getRandomGarment(garments));
    }

    console.log(`Generating ${numVariants} variants...`);

    // 🔥 НЕ БЛОКИРУЕМ ВСЁ (фикс)
    const promises = garments.map(g =>
      generateSingle(
        imageBase64,
        stylePrompt || "",
        customPrompt || "",
        aspectRatio,
        g
      )
    );

    const results = await Promise.allSettled(promises);

    // 🔥 собираем только успешные
    const imageUrls = results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<string>).value);

    console.log(`Success: ${imageUrls.length}/${numVariants}`);

    // 🔥 УБИВАЕМ partial
    if (imageUrls.length !== numVariants) {
      throw new Error(
        `Partial generation: ${imageUrls.length}/${numVariants}`
      );
    }

    // 🔥 общий таймаут защиты
    if (Date.now() - startTime > MAX_TIME) {
      throw new Error("Generation timeout");
    }

    return new Response(
      JSON.stringify({
        imageUrl: imageUrls[0],
        imageUrls,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("FINAL ERROR:", err.message);

    return new Response(
      JSON.stringify({
        error: err.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

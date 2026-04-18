// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
  return available[Math.floor(Math.random() * available.length)] || WARDROBE[0];
}

const PER_CALL_TIMEOUT_MS = 90_000; // 90s per AI call — never hang

async function generateSingle(imageBase64: string, stylePrompt: string, customPrompt: string, garment: string): Promise<string | null> {
  const prompt = `Luxury fashion portrait. Place THIS EXACT FACE into a new scene. Preserve identity, geometry, jaw width strictly.
OUTFIT: ${garment}
${stylePrompt ? `Style: ${stylePrompt}` : ""}
${customPrompt ? `Note: ${customPrompt}` : ""}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        }],
        modalities: ["image", "text"],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI error ${response.status}:`, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error(`generateSingle timeout after ${PER_CALL_TIMEOUT_MS}ms`);
    } else {
      console.error("generateSingle exception:", e.message);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, customerKey } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load order
    const { data: order, error: loadErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (loadErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (customerKey && order.customer_key && order.customer_key !== customerKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: only allow retry for paid orders that are not yet successfully completed
    if (order.payment_status !== "succeeded") {
      return new Response(JSON.stringify({ error: "Order not paid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.generation_status === "done" && order.results?.length >= order.photos_count) {
      return new Response(JSON.stringify({ alreadyDone: true, results: order.results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.generation_status === "running") {
      return new Response(JSON.stringify({ alreadyRunning: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.original_image) {
      return new Response(JSON.stringify({ error: "No source image" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark running, reset previous error
    await supabase.from("orders")
      .update({ generation_status: "running" })
      .eq("id", orderId);

    console.log(`[RETRY] Order ${orderId}: starting retry generation, photos_count=${order.photos_count}`);

    // Fetch image
    let imageBase64: string;
    try {
      const imgResp = await fetch(order.original_image);
      if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status}`);
      const imgBuf = await imgResp.arrayBuffer();
      const uint8 = new Uint8Array(imgBuf);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      imageBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (imgErr: any) {
      console.error("[RETRY] Image fetch failed:", imgErr.message);
      await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
      return new Response(JSON.stringify({ error: "Image fetch failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Background generation (do not await — return immediately so client can poll)
    const totalPhotos = order.photos_count;
    const BATCH_SIZE = 3;
    const MAX_RETRIES = 2;
    const stylePrompt = order.style_ids?.length > 0
      ? order.style_ids.join(", ")
      : "Luxury fashion portrait photography";

    const runGeneration = async () => {
      const allImageUrls: string[] = [...(order.results || [])];
      const usedGarments: string[] = [];

      // Helper: persist current state — best effort, never throws
      const persistResults = async () => {
        try {
          await supabase.from("orders").update({ results: allImageUrls }).eq("id", orderId);
        } catch (e: any) {
          console.error(`[RETRY] persistResults error: ${e?.message}`);
        }
      };

      // Helper: pick next garment
      const nextGarment = () => {
        const g = getRandomGarment(usedGarments);
        usedGarments.push(g);
        if (usedGarments.length >= WARDROBE.length) usedGarments.length = 0;
        return g;
      };

      // Helper: finalize — ALWAYS sets terminal status, never leaves running
      const finalize = async (label: string) => {
        try {
          if (allImageUrls.length >= totalPhotos) {
            allImageUrls.length = totalPhotos;
            await supabase.from("orders")
              .update({ generation_status: "done", results: allImageUrls })
              .eq("id", orderId);
            console.log(`[RETRY] Order ${orderId}: DONE (${label}) — ${allImageUrls.length}/${totalPhotos}`);
          } else {
            await supabase.from("orders")
              .update({ generation_status: "error", results: allImageUrls })
              .eq("id", orderId);
            console.error(`[RETRY] Order ${orderId}: ERROR (${label}) — ${allImageUrls.length}/${totalPhotos}`);
          }
        } catch (e: any) {
          console.error(`[RETRY] finalize fatal: ${e?.message}`);
        }
      };

      try {
        // Main pass + retry rounds, sequential batches with incremental save
        const totalRounds = 1 + MAX_RETRIES;
        for (let round = 0; round < totalRounds && allImageUrls.length < totalPhotos; round++) {
          const remaining = totalPhotos - allImageUrls.length;
          console.log(`[RETRY] Order ${orderId}: round ${round + 1}/${totalRounds}, need ${remaining} more`);

          for (let i = 0; i < remaining && allImageUrls.length < totalPhotos; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, totalPhotos - allImageUrls.length);
            const garments = Array.from({ length: batchCount }, () => nextGarment());

            // Each photo independently — failures don't abort the batch
            const settled = await Promise.allSettled(
              garments.map(g => generateSingle(imageBase64, stylePrompt, order.custom_prompt || "", g))
            );
            for (const s of settled) {
              if (s.status === "fulfilled" && s.value) {
                allImageUrls.push(s.value);
                if (allImageUrls.length >= totalPhotos) break;
              }
            }

            // Persist after EVERY batch so progress survives isolate kill
            await persistResults();
            console.log(`[RETRY] Order ${orderId}: ${allImageUrls.length}/${totalPhotos}`);
          }
        }

        await finalize("complete");
      } catch (e: any) {
        console.error(`[RETRY] Order ${orderId}: exception — ${e?.message}`);
        await finalize("exception");
      }
    };

    // Fire-and-forget so HTTP response returns fast
    EdgeRuntime.waitUntil ? EdgeRuntime.waitUntil(runGeneration()) : runGeneration();

    return new Response(JSON.stringify({ ok: true, orderId, status: "running" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("retry-generation error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

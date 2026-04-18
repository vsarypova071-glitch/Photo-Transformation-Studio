// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const PER_CALL_TIMEOUT_MS = 60000; // 60 сек
const MAX_TOTAL_TIME = 180000; // 3 минуты

async function generateSingle(
  imageBase64: string,
  prompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(
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
        signal: controller.signal,
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  // 🟢 STAGE 1.1 — самая первая строка: подтверждаем что webhook вообще вызвали
  console.log(`[WEBHOOK] ▶ Incoming ${req.method} request from ${req.headers.get("x-forwarded-for") ?? "unknown"} at ${new Date().toISOString()}`);

  if (req.method === "OPTIONS") {
    console.log("[WEBHOOK] OPTIONS preflight — returning CORS headers");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rawBody = await req.text();
    console.log(`[WEBHOOK] Raw body (${rawBody.length} bytes): ${rawBody.slice(0, 500)}`);

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[WEBHOOK] ❌ JSON parse failed:", parseErr);
      return new Response("OK", { status: 200 });
    }

    const event = body?.event ?? "unknown";
    const payment = body.object;
    const orderId = payment?.metadata?.order_id;
    const paymentId = payment?.id;
    const paymentStatus = payment?.status;

    console.log(`[WEBHOOK] event=${event} payment_id=${paymentId} status=${paymentStatus} order_id=${orderId}`);

    if (!orderId) {
      console.warn("[WEBHOOK] ⚠ No order_id in metadata — ignoring");
      return new Response("OK", { status: 200 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr) {
      console.error(`[WEBHOOK] ❌ Failed to load order ${orderId}:`, orderErr.message);
    }

    if (!order) {
      console.warn(`[WEBHOOK] ⚠ Order ${orderId} not found in DB — ignoring`);
      return new Response("OK", { status: 200 });
    }

    console.log(`[WEBHOOK] Loaded order ${orderId}: payment=${order.payment_status} gen=${order.generation_status} photos=${order.photos_count}`);

    // 🔒 защита от повторного запуска
    if (["running", "done", "error"].includes(order.generation_status)) {
      console.log(`[WEBHOOK] 🔒 Order already in terminal/active status (${order.generation_status}) — skipping`);
      return new Response("OK", { status: 200 });
    }

    // старт
    console.log(`[WEBHOOK] ▶ Starting generation for order ${orderId}`);
    await supabase
      .from("orders")
      .update({
        payment_status: "succeeded",
        generation_status: "running",
      })
      .eq("id", orderId)
      .not("generation_status", "in", '("done","error")');

    // === ЗАГРУЗКА КАРТИНКИ ===
    let imageBase64: string;
    try {
      const resp = await fetch(order.original_image);
      const buf = await resp.arrayBuffer();
      imageBase64 = `data:image/jpeg;base64,${btoa(
        String.fromCharCode(...new Uint8Array(buf))
      )}`;
    } catch {
      await supabase
        .from("orders")
        .update({ generation_status: "error" })
        .eq("id", orderId)
        .not("generation_status", "in", '("done","error")');

      return new Response("OK", { status: 200 });
    }

    // === ГЕНЕРАЦИЯ ===
    const runGeneration = async () => {
      const startTime = Date.now();
      const results: string[] = [];

      const finalize = async (status: "done" | "error", missingCount = 0) => {
        await supabase
          .from("orders")
          .update({
            generation_status: status,
            results,
          })
          .eq("id", orderId)
          .not("generation_status", "in", '("done","error")');

        // STAGE 3.2: full refund — generation completely failed (0 results)
        // STAGE 3.1: partial refund — some results delivered, refund only for missing photos
        const needsRefund =
          (status === "error" && results.length === 0) ||
          (status === "done" && missingCount > 0);

        if (needsRefund) {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
          const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const isPartial = status === "done" && missingCount > 0;
          fetch(`${SUPABASE_URL}/functions/v1/auto-refund-order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(
              isPartial
                ? { orderId, partial: true, missingCount }
                : { orderId }
            ),
          })
            .then(r => r.text().then(t => console.log(`[WEBHOOK→REFUND${isPartial ? " PARTIAL" : ""}] ${r.status}: ${t}`)))
            .catch(e => console.error("[WEBHOOK→REFUND] trigger failed:", e));
        }
      };

      try {
        const total = order.photos_count || 3;

        for (let i = 0; i < total; i++) {
          if (Date.now() - startTime > MAX_TOTAL_TIME) {
            console.error("GLOBAL TIMEOUT");
            await finalize("error");
            return;
          }

          const res = await generateSingle(
            imageBase64,
            "Luxury portrait"
          );

          if (!res) continue;

          results.push(res);

          await supabase
            .from("orders")
            .update({ results })
            .eq("id", orderId);
        }

        // STAGE 3.1: deliver whatever we have — partial success is still success
        if (results.length === 0) {
          await finalize("error");
        } else if (results.length < total) {
          await finalize("done", total - results.length);
        } else {
          await finalize("done");
        }
      } catch (e) {
        console.error("GEN ERROR", e);
        await finalize("error");
      }
    };

    runGeneration();

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    return new Response("OK", { status: 200 });
  }
});

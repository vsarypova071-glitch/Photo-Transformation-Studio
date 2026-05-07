// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STUCK_TIMEOUT_MS = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const YOOKASSA_SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID")?.trim();
    const YOOKASSA_SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY")?.trim();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, payment_status, generation_status, results, payment_id, photos_count, price, updated_at, original_image, style_ids, customer_key")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPaid = order.payment_status === "succeeded";
    const isTerminal = order.generation_status === "done" || order.generation_status === "error" || order.generation_status === "canceled" || order.generation_status === "credits_credited";
    const isStuckActive = (order.generation_status === "running" || order.generation_status === "waiting")
      && (Date.now() - new Date(order.updated_at).getTime() > STUCK_TIMEOUT_MS);

    if (isPaid && !isTerminal && isStuckActive) {
      await supabase
        .from("orders")
        .update({ generation_status: "error" })
        .eq("id", orderId);

      // STAGE 3.2: trigger auto-refund (fire-and-forget). Refund function self-validates eligibility.
      fetch(`${SUPABASE_URL}/functions/v1/auto-refund-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ orderId }),
      })
        .then(r => r.text().then(t => console.log(`[CHECK→REFUND ${orderId}] ${r.status}: ${t.slice(0, 200)}`)))
        .catch(e => console.error(`[CHECK→REFUND ${orderId}] trigger failed:`, e));

      return new Response(JSON.stringify({
        orderId: order.id,
        paymentStatus: order.payment_status,
        generationStatus: "error",
        results: order.results || [],
        photosCount: order.photos_count,
        price: order.price,
        paymentMethod: order.payment_id?.startsWith("credits_") ? "credits" : "rub",
        originalImage: order.original_image || null,
        styleIds: order.style_ids || [],
        customerKey: order.customer_key || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already done or has results — return immediately
    if (order.generation_status === "done" && order.results?.length > 0) {
      return new Response(JSON.stringify({
        orderId: order.id,
        paymentStatus: order.payment_status,
        generationStatus: order.generation_status,
        results: order.results,
        photosCount: order.photos_count,
        price: order.price,
        paymentMethod: order.payment_id?.startsWith("credits_") ? "credits" : "rub",
        originalImage: order.original_image || null,
        styleIds: order.style_ids || [],
        customerKey: order.customer_key || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If still pending, check YooKassa directly
    if (order.payment_status === "pending" && order.payment_id && YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
      const encoder = new TextEncoder();
      const credentialsString = `${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`;
      const credentialsBytes = encoder.encode(credentialsString);
      const credentials = encodeBase64(credentialsBytes);
      try {
        const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${order.payment_id}`, {
          headers: { "Authorization": `Basic ${credentials}` },
        });
        const yooData = await yooRes.json();

        if (yooData.status === "succeeded") {
          // Only trigger generation if not already running/done (idempotency)
          if (order.generation_status === "waiting") {
            await supabase
              .from("orders")
              .update({ payment_status: "succeeded", generation_status: "running" })
              .eq("id", orderId);

            // Trigger generation via webhook function (fire-and-forget)
            const webhookUrl = `${SUPABASE_URL}/functions/v1/yookassa-webhook`;
            fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                event: "payment.succeeded",
                object: { id: order.payment_id, status: "succeeded", metadata: { order_id: orderId } },
              }),
            }).catch(e => console.error("Trigger webhook error:", e));
          }

          return new Response(JSON.stringify({
            orderId,
            paymentStatus: "succeeded",
            generationStatus: order.generation_status === "waiting" ? "running" : order.generation_status,
            results: order.results || [],
            photosCount: order.photos_count,
            price: order.price,
            paymentMethod: order.payment_id?.startsWith("credits_") ? "credits" : "rub",
            originalImage: order.original_image || null,
            styleIds: order.style_ids || [],
            customerKey: order.customer_key || null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } else if (yooData.status === "canceled") {
          await supabase.from("orders")
            .update({ payment_status: "canceled", generation_status: "canceled" })
            .eq("id", orderId);
          return new Response(JSON.stringify({
            orderId,
            paymentStatus: "canceled",
            generationStatus: "canceled",
            results: [],
            photosCount: order.photos_count,
            customerKey: order.customer_key || null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.error("YooKassa check error:", e);
      }
    }

    // Return current partial results if generation is running
    return new Response(JSON.stringify({
      orderId: order.id,
      paymentStatus: order.payment_status,
      generationStatus: order.generation_status,
      results: order.results || [],
      photosCount: order.photos_count,
      price: order.price,
      paymentMethod: order.payment_id?.startsWith("credits_") ? "credits" : "rub",
      originalImage: order.original_image || null,
      styleIds: order.style_ids || [],
      customerKey: order.customer_key || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("check-order error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

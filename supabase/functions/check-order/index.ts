// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const YOOKASSA_SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID");
    const YOOKASSA_SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY");

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
      .select("id, payment_status, generation_status, results, payment_id")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If still pending, check YooKassa directly
    if (order.payment_status === "pending" && order.payment_id && YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
      const credentials = btoa(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`);
      try {
        const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${order.payment_id}`, {
          headers: { "Authorization": `Basic ${credentials}` },
        });
        const yooData = await yooRes.json();

        if (yooData.status === "succeeded") {
          // Trigger the same flow as webhook
          await supabase
            .from("orders")
            .update({ payment_status: "succeeded", generation_status: "running" })
            .eq("id", orderId);

          // Trigger generation via webhook function
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

          return new Response(JSON.stringify({
            orderId,
            paymentStatus: "succeeded",
            generationStatus: "running",
            results: [],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else if (yooData.status === "canceled") {
          await supabase.from("orders").update({ payment_status: "canceled" }).eq("id", orderId);
          return new Response(JSON.stringify({
            orderId,
            paymentStatus: "canceled",
            generationStatus: "waiting",
            results: [],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.error("YooKassa check error:", e);
      }
    }

    return new Response(JSON.stringify({
      orderId: order.id,
      paymentStatus: order.payment_status,
      generationStatus: order.generation_status,
      results: order.results || [],
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

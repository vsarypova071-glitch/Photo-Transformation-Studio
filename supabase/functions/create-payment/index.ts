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
    const YOOKASSA_SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID");
    const YOOKASSA_SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tariffId, price, photosCount, userSessionId, styleIds, originalImage, customPrompt, isFullBody } = await req.json();

    if (!tariffId || !price || !photosCount || !userSessionId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resource availability check per tariff
    const RESOURCE_THRESHOLDS: Record<string, number> = {
      basic: 10,
      standard: 25,
      premium: 60,
    };

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Count active (non-completed) orders to estimate load
    const { count: activeOrders, error: countError } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("generation_status", ["waiting", "processing"]);

    const currentLoad = activeOrders ?? 0;
    const threshold = RESOURCE_THRESHOLDS[tariffId] ?? 10;

    if (currentLoad >= threshold) {
      console.log(`Resource check failed: ${currentLoad} active orders >= threshold ${threshold} for tariff ${tariffId}`);
      return new Response(JSON.stringify({ 
        error: "Сервис временно перегружен. Попробуйте через несколько минут." 
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order in DB
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_session_id: userSessionId,
        tariff_id: tariffId,
        photos_count: photosCount,
        price,
        style_ids: styleIds || [],
        original_image: originalImage || null,
        custom_prompt: customPrompt || null,
        is_full_body: isFullBody || false,
        payment_status: "pending",
        generation_status: "waiting",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = order.id;

    // Create YooKassa payment
    const idempotenceKey = crypto.randomUUID();
    const returnUrl = `${req.headers.get("origin") || "https://photo-transformation-studio.lovable.app"}?order_id=${orderId}`;

    const paymentBody = {
      amount: {
        value: price.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      capture: true,
      description: `AI фотосессия — ${tariffId} (${photosCount} фото)`,
      receipt: {
        customer: {
          email: "customer@example.com",
        },
        items: [
          {
            description: `AI фотосессия — ${photosCount} фото`,
            quantity: "1.00",
            amount: {
              value: price.toFixed(2),
              currency: "RUB",
            },
            vat_code: 1,
            payment_subject: "service",
            payment_mode: "full_payment",
          },
        ],
      },
      metadata: {
        order_id: orderId,
        tariff_id: tariffId,
        photos_count: String(photosCount),
      },
    };

    const credentials = btoa(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`);

    const yooResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const yooData = await yooResponse.json();

    if (!yooResponse.ok) {
      console.error("YooKassa error:", JSON.stringify(yooData));
      return new Response(JSON.stringify({ error: "Payment creation failed", details: yooData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save payment_id to order
    await supabase
      .from("orders")
      .update({ payment_id: yooData.id })
      .eq("id", orderId);

    console.log(`Payment created: ${yooData.id} for order ${orderId}`);

    return new Response(JSON.stringify({
      orderId,
      paymentUrl: yooData.confirmation.confirmation_url,
      paymentId: yooData.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-payment error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

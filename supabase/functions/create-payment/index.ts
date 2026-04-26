// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARIFF_CONFIG = {
  basic: { price: 479, photosCount: 5 },
  standard: { price: 1299, photosCount: 15 },
  premium: { price: 2999, photosCount: 50 },
} as const;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arraysEqual(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

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

    const body = await req.json();
    const { tariffId, userSessionId, styleIds, originalImageUrl, customPrompt, isFullBody, customerKey } = body;

    if (!tariffId || !userSessionId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tariff = TARIFF_CONFIG[tariffId as keyof typeof TARIFF_CONFIG];
    if (!tariff) {
      return new Response(JSON.stringify({ error: "Invalid tariff" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const price = tariff.price;
    const photosCount = tariff.photosCount;
    const safeStyleIds = Array.isArray(styleIds) ? styleIds.filter((id): id is string => typeof id === "string") : [];
    const safeOriginalImageUrl = typeof originalImageUrl === "string" && originalImageUrl.trim().length > 0
      ? originalImageUrl
      : null;
    const safeCustomPrompt = normalizeText(customPrompt) || null;
    const safeIsFullBody = Boolean(isFullBody);

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // === CHECK 0: SAFEGUARD — reuse last paid order (any status) within 24h instead of charging again ===
    if (customerKey) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingPaidOrder } = await supabaseAdmin
        .from("orders")
        .select("id, payment_status, generation_status, results, photos_count, tariff_id, created_at")
        .eq("customer_key", customerKey)
        .eq("payment_status", "succeeded")
        .in("generation_status", ["waiting", "running", "error", "done"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPaidOrder) {
        // For 'done' orders: only reuse if results actually exist (otherwise fall through and let user pay again)
        const hasResults = Array.isArray(existingPaidOrder.results) && existingPaidOrder.results.length > 0;
        const shouldReuse = existingPaidOrder.generation_status !== "done" || hasResults;

        if (shouldReuse) {
          console.log(`[SAFEGUARD] Customer ${customerKey} has paid order ${existingPaidOrder.id} (gen=${existingPaidOrder.generation_status}, results=${existingPaidOrder.results?.length ?? 0}). Returning existingOrder.`);
          return new Response(JSON.stringify({
            existingOrder: true,
            orderId: existingPaidOrder.id,
            generationStatus: existingPaidOrder.generation_status,
            paymentStatus: existingPaidOrder.payment_status,
            photosCount: existingPaidOrder.photos_count,
            results: existingPaidOrder.results || [],
            message: "У вас уже есть оплаченный заказ. Возвращаем к нему.",
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          console.log(`[SAFEGUARD] Order ${existingPaidOrder.id} is 'done' but has no results — allowing new payment.`);
        }
      }

      // === STAGE 1.2 — DUPLICATE PROTECTION: reuse existing pending order < 10 min ===
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existingPendingOrders } = await supabaseAdmin
        .from("orders")
        .select("id, payment_id, payment_status, created_at, tariff_id, price, photos_count, style_ids, original_image, custom_prompt, is_full_body")
        .eq("customer_key", customerKey)
        .eq("payment_status", "pending")
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      const existingPending = existingPendingOrders?.find((pendingOrder) => (
        pendingOrder.payment_id &&
        pendingOrder.tariff_id === tariffId &&
        pendingOrder.price === price &&
        pendingOrder.photos_count === photosCount &&
        arraysEqual(pendingOrder.style_ids ?? [], safeStyleIds) &&
        (pendingOrder.original_image ?? null) === safeOriginalImageUrl &&
        normalizeText(pendingOrder.custom_prompt) === (safeCustomPrompt ?? "") &&
        Boolean(pendingOrder.is_full_body) === safeIsFullBody
      ));

      if (existingPending?.payment_id) {
        // Re-fetch payment URL from YooKassa for the existing pending payment
        try {
          const credentials = btoa(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`);
          const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${existingPending.payment_id}`, {
            headers: { "Authorization": `Basic ${credentials}` },
          });
          const yooData = await yooRes.json();

          if (yooRes.ok && yooData.status === "pending" && yooData.confirmation?.confirmation_url) {
            console.log(`[DUPLICATE-GUARD] Reusing existing pending order ${existingPending.id} for customer ${customerKey}`);
            return new Response(JSON.stringify({
              orderId: existingPending.id,
              paymentUrl: yooData.confirmation.confirmation_url,
              paymentId: existingPending.payment_id,
              reused: true,
            }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            console.log(`[DUPLICATE-GUARD] Existing pending order ${existingPending.id} is no longer pending in YooKassa (status=${yooData.status}). Allowing new payment.`);
          }
        } catch (e) {
          console.warn(`[DUPLICATE-GUARD] Failed to re-fetch YooKassa payment ${existingPending.payment_id}:`, e);
          // Fall through: create new payment if we cannot verify
        }
      }
    }

    // === CHECK 1: Load check — count active orders (waiting/processing) ===
    const LOAD_LIMITS: Record<string, number> = {
      basic: 50,
      standard: 25,
      premium: 10,
    };
    const maxActive = LOAD_LIMITS[tariffId] ?? 10;

    const { count: activeCount, error: countError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("generation_status", "running")
      .eq("payment_status", "succeeded");

    if (countError) {
      console.error("Load check query error:", countError);
      return new Response(JSON.stringify({ error: "Сервис временно недоступен" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentLoad = activeCount ?? 0;
    console.log(`Load check: ${currentLoad} active orders, limit for ${tariffId}: ${maxActive}`);

    if (currentLoad >= maxActive) {
      console.log(`Load limit exceeded for ${tariffId}: ${currentLoad}/${maxActive}`);
      return new Response(JSON.stringify({
        error: "Сервис временно перегружен, попробуйте через несколько минут"
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CHECK 2: AI balance check ===
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiCheckPassed = false;

    if (LOVABLE_API_KEY) {
      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => aiController.abort(), 10_000);
      try {
        const testResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1,
          }),
          signal: aiController.signal,
        });

        if (testResponse.status === 402) {
          console.log(`AI balance insufficient for tariff ${tariffId}`);
          return new Response(JSON.stringify({
            error: "Временно нет доступных ресурсов, попробуйте позже"
          }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        aiCheckPassed = testResponse.ok;
      } catch (aiErr: any) {
        console.error("AI balance check network error:", aiErr.message);
        aiCheckPassed = false;
      } finally {
        clearTimeout(aiTimeoutId);
      }
    }

    // If AI check failed (network/timeout) — block premium, allow basic
    if (!aiCheckPassed) {
      if (tariffId === "premium") {
        console.log("AI check failed, blocking premium tariff");
        return new Response(JSON.stringify({
          error: "Временно нет доступных ресурсов, попробуйте позже"
        }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn(`AI check did not pass for ${tariffId}, allowing with caution`);
    }

    // === CREATE ORDER ===
    const supabase = supabaseAdmin;
    
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_session_id: userSessionId,
        tariff_id: tariffId,
        photos_count: photosCount,
        price,
        style_ids: safeStyleIds,
        original_image: safeOriginalImageUrl,
        custom_prompt: safeCustomPrompt,
        is_full_body: safeIsFullBody,
        payment_status: "pending",
        generation_status: "waiting",
        customer_key: customerKey || null,
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
        customer_key: customerKey || "",
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

// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

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
    const YOOKASSA_SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID")?.trim();
    const YOOKASSA_SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY")?.trim();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tariffId, userSessionId, styleIds, originalImageUrl, customPrompt, isFullBody, customerKey, customerEmail } = body;

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const safeEmail = typeof customerEmail === "string" ? customerEmail.trim() : "";
    if (!safeEmail || !emailRegex.test(safeEmail)) {
      return new Response(JSON.stringify({ error: "Укажите корректный email для получения чека об оплате" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // === DUPLICATE PROTECTION: reuse existing pending YooKassa payment < 10 min ===
    // Старый SAFEGUARD на done/running/error удалён намеренно: новая система работает
    // только через кредиты (webhook → credits_credited → Studio). Любой повторный
    // запрос оплаты создаёт НОВЫЙ pending order, кроме случая активного pending платежа
    // в YooKassa — его переиспользуем, чтобы не плодить дубликаты при двойном клике.
    if (customerKey) {
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
          const encoder = new TextEncoder();
          const credentialsString = `${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`;
          const credentialsBytes = encoder.encode(credentialsString);
          const credentials = encodeBase64(credentialsBytes);
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
    const returnUrl = `${req.headers.get("origin") || "https://ai-fotosessia.ru"}?order_id=${orderId}`;

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
          email: safeEmail,
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

    // === DIAGNOSTIC: YooKassa credentials ===
    console.log('[YOOKASSA-DEBUG] shopId value:', YOOKASSA_SHOP_ID);
    console.log('[YOOKASSA-DEBUG] shopId length:', YOOKASSA_SHOP_ID?.length ?? 0);
    console.log('[YOOKASSA-DEBUG] secret exists:', !!YOOKASSA_SECRET_KEY);
    console.log('[YOOKASSA-DEBUG] secret length:', YOOKASSA_SECRET_KEY?.length ?? 0);
    if (YOOKASSA_SECRET_KEY) {
      const startsWithLive = YOOKASSA_SECRET_KEY.startsWith('live_');
      const startsWithTest = YOOKASSA_SECRET_KEY.startsWith('test_');
      console.log('[YOOKASSA-DEBUG] secret starts with "live_":', startsWithLive);
      console.log('[YOOKASSA-DEBUG] secret starts with "test_":', startsWithTest);
      console.log('[YOOKASSA-DEBUG] secret has spaces:', YOOKASSA_SECRET_KEY.includes(' '));
      console.log('[YOOKASSA-DEBUG] secret has newlines:', YOOKASSA_SECRET_KEY.includes('\n'));
      console.log('[YOOKASSA-DEBUG] secret preview:', YOOKASSA_SECRET_KEY.substring(0, 5) + '...' + YOOKASSA_SECRET_KEY.substring(YOOKASSA_SECRET_KEY.length - 4));
    }

    // Use Deno standard library for reliable base64 encoding
    const credentialsString = `${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentialsString);
    const credentialsBase64 = encodeBase64(credentialsBytes);


    console.log('[YOOKASSA-DEBUG] === PAYMENT REQUEST ===');
    console.log('[YOOKASSA-DEBUG] URL: https://api.yookassa.ru/v3/payments');
    console.log('[YOOKASSA-DEBUG] Method: POST');
    console.log('[YOOKASSA-DEBUG] Authorization header:', `Basic ${credentialsBase64}`);
    console.log('[YOOKASSA-DEBUG] Idempotence-Key:', idempotenceKey);
    console.log('[YOOKASSA-DEBUG] Request body:', JSON.stringify(paymentBody));

    const yooResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentialsBase64}`,
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const yooData = await yooResponse.json();

    console.log('[YOOKASSA-DEBUG] === PAYMENT RESPONSE ===');
    console.log('[YOOKASSA-DEBUG] Status:', yooResponse.status);
    console.log('[YOOKASSA-DEBUG] Response:', JSON.stringify(yooData));

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

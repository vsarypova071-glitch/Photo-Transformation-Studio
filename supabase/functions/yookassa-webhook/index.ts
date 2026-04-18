// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 🟢 STAGE WALLET 1.2:
// При успешной оплате теперь НЕ запускаем генерацию.
// Вместо этого начисляем photos_count кредитов на credit_accounts (модель «кошелёк»).
// Старая логика генерации сохранена ниже в виде комментариев на случай отката.

Deno.serve(async (req: Request) => {
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

    // Обрабатываем только успешные платежи
    if (paymentStatus !== "succeeded" && event !== "payment.succeeded") {
      console.log(`[WEBHOOK] Ignoring non-success status: ${paymentStatus}`);
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

    console.log(`[WEBHOOK] Loaded order ${orderId}: payment=${order.payment_status} gen=${order.generation_status} photos=${order.photos_count} credits_purchased=${order.credits_purchased}`);

    // 🔒 Идемпотентность: если уже начислены кредиты — выходим
    if (order.credits_purchased > 0) {
      console.log(`[WEBHOOK] 🔒 Credits already purchased for order ${orderId} (${order.credits_purchased}) — skipping`);
      return new Response("OK", { status: 200 });
    }

    const customerKey = (order.customer_key || "").trim().toLowerCase();
    if (!customerKey) {
      console.error(`[WEBHOOK] ❌ Order ${orderId} has no customer_key — cannot credit wallet`);
      return new Response("OK", { status: 200 });
    }

    const photosCount = order.photos_count || 0;
    if (photosCount <= 0) {
      console.error(`[WEBHOOK] ❌ Order ${orderId} has invalid photos_count=${photosCount}`);
      return new Response("OK", { status: 200 });
    }

    // === 1. Получаем или создаём credit_account ===
    let { data: account, error: accountErr } = await supabase
      .from("credit_accounts")
      .select("id, balance")
      .eq("customer_key", customerKey)
      .maybeSingle();

    if (accountErr) {
      console.error(`[WEBHOOK] ❌ Account lookup failed:`, accountErr.message);
      return new Response("OK", { status: 200 });
    }

    if (!account) {
      console.log(`[WEBHOOK] Creating new credit_account for ${customerKey}`);
      const { data: newAccount, error: createErr } = await supabase
        .from("credit_accounts")
        .insert({ customer_key: customerKey, balance: 0 })
        .select("id, balance")
        .single();

      if (createErr || !newAccount) {
        console.error(`[WEBHOOK] ❌ Failed to create account:`, createErr?.message);
        return new Response("OK", { status: 200 });
      }
      account = newAccount;
    }

    // === 2. Идемпотентное начисление через credit_transactions ===
    const topupKey = `topup_order_${orderId}`;
    const { error: txErr } = await supabase
      .from("credit_transactions")
      .insert({
        account_id: account.id,
        order_id: orderId,
        type: "topup",
        amount: photosCount,
        idempotency_key: topupKey,
        description: `Пополнение за заказ ${order.tariff_id} (${photosCount} фото)`,
      });

    if (txErr) {
      if (txErr.code === "23505") {
        console.log(`[WEBHOOK] Topup transaction already exists for order ${orderId} — skipping balance update`);
      } else {
        console.error(`[WEBHOOK] ❌ Failed to insert topup transaction:`, txErr.message);
        return new Response("OK", { status: 200 });
      }
    } else {
      // === 3. Атомарно увеличиваем баланс через RPC refund_balance (он просто прибавляет) ===
      const { data: newBalance, error: rpcErr } = await supabase
        .rpc("refund_balance", { p_account_id: account.id, p_amount: photosCount });

      if (rpcErr) {
        console.error(`[WEBHOOK] ❌ Balance topup RPC failed:`, rpcErr.message);
        // Откат транзакции
        await supabase.from("credit_transactions").delete().eq("idempotency_key", topupKey);
        return new Response("OK", { status: 200 });
      }
      console.log(`[WEBHOOK] ✅ Credited ${photosCount} photos to ${customerKey}, new balance: ${newBalance}`);
    }

    // === 4. Обновляем order: помечаем как оплаченный + сохраняем кол-во купленных кредитов ===
    await supabase
      .from("orders")
      .update({
        payment_status: "succeeded",
        generation_status: "credits_credited", // новый статус для кошельковых заказов
        credits_purchased: photosCount,
      })
      .eq("id", orderId);

    console.log(`[WEBHOOK] ✅ Order ${orderId} marked as credits_credited`);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[WEBHOOK] ❌ ERROR", err);
    return new Response("OK", { status: 200 });
  }
});

/* ============================================================
 * 🗄️  СТАРАЯ ЛОГИКА (до перехода на кошелёк) — для отката
 * ============================================================
 *
 * Раньше webhook сразу запускал генерацию photos_count фото подряд.
 * Если нужно откатиться — восстановить блок ниже вместо новой логики:
 *
 * - Загружал original_image из storage в base64
 * - Запускал runGeneration() в фоне: цикл по photos_count, вызов
 *   Lovable AI Gateway (google/gemini-3-pro-image-preview)
 * - Складывал результаты в orders.results (массив URL/base64)
 * - При полном/частичном фейле дёргал auto-refund-order
 * - Финализировал generation_status = done | error
 *
 * Полный исходник смотри в git history этого файла (коммит до WALLET 1.2).
 * ============================================================ */

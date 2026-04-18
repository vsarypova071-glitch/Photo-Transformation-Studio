// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// STAGE 3.2: Idempotent auto-refund for failed generations.
// Triggered when an order ends in: payment_status='succeeded'
// + generation_status='error' + results.length === 0 (full refund).
// STAGE 3.1: also called for partial success (done + results < photos_count)
// with { partial: true, missingCount } — refunds only for missing photos.
// Two refund paths:
//   - Credit-paid orders (payment_id starts with 'credits_'): refund_balance RPC
//   - YooKassa-paid orders: YooKassa Refund API
// On full refund the order's payment_status becomes 'refunded'.
// On partial refund payment_status stays 'succeeded' (order is partially fulfilled).

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const YOOKASSA_SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID");
    const YOOKASSA_SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let orderId: string | null = null;
    if (req.method === "GET") {
      orderId = new URL(req.url).searchParams.get("order_id");
    } else {
      const body = await req.json().catch(() => ({}));
      orderId = body.orderId || body.order_id || null;
    }

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, payment_status, generation_status, results, payment_id, photos_count, price, customer_key, tariff_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      console.warn(`[REFUND] Order ${orderId} not found`);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip already-refunded
    if (order.payment_status === "refunded") {
      console.log(`[REFUND] Order ${orderId} already refunded — skipping`);
      return new Response(JSON.stringify({ ok: true, alreadyRefunded: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Eligibility check
    const hasResults = Array.isArray(order.results) && order.results.length > 0;
    if (
      order.payment_status !== "succeeded" ||
      order.generation_status !== "error" ||
      hasResults
    ) {
      console.log(`[REFUND] Order ${orderId} NOT eligible: pay=${order.payment_status} gen=${order.generation_status} results=${order.results?.length ?? 0}`);
      return new Response(JSON.stringify({
        ok: false,
        skipped: true,
        reason: "not eligible (need succeeded + error + 0 results)",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === IDEMPOTENCY GUARD ===
    // For credit-paid orders we use credit_transactions.idempotency_key.
    // For YooKassa we set payment_status='refunded' atomically AFTER refund.
    const refundKey = `refund_${orderId}`;

    // === PATH A: CREDIT REFUND ===
    if (order.payment_id && order.payment_id.startsWith("credits_")) {
      if (!order.customer_key) {
        console.error(`[REFUND] Credit order ${orderId} has no customer_key`);
        return new Response(JSON.stringify({ error: "missing customer_key" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: account, error: accErr } = await supabase
        .from("credit_accounts")
        .select("id, balance")
        .eq("customer_key", order.customer_key.trim().toLowerCase())
        .maybeSingle();

      if (accErr || !account) {
        console.error(`[REFUND] No credit_account for ${order.customer_key}:`, accErr?.message);
        return new Response(JSON.stringify({ error: "credit account not found" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if refund-tx already exists (idempotency)
      const { data: existingTx } = await supabase
        .from("credit_transactions")
        .select("id")
        .eq("idempotency_key", refundKey)
        .maybeSingle();

      if (existingTx) {
        console.log(`[REFUND] Credit refund ${refundKey} already exists — only flipping status`);
      } else {
        // Insert refund transaction
        const { error: txErr } = await supabase
          .from("credit_transactions")
          .insert({
            account_id: account.id,
            order_id: orderId,
            type: "refund",
            amount: order.photos_count,
            idempotency_key: refundKey,
            description: `Возврат кредитов за неуспешную генерацию заказа ${orderId}`,
          });

        if (txErr) {
          // 23505 = unique violation (race) → safe to continue
          if (txErr.code !== "23505") {
            console.error(`[REFUND] Insert refund tx failed:`, txErr);
            return new Response(JSON.stringify({ error: "refund tx insert failed" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          // Atomic balance refund
          const { data: newBal, error: refErr } = await supabase
            .rpc("refund_balance", { p_account_id: account.id, p_amount: order.photos_count });

          if (refErr || newBal === -1) {
            console.error(`[REFUND] refund_balance RPC failed:`, refErr);
            // Rollback tx so retry can re-attempt
            await supabase.from("credit_transactions").delete().eq("idempotency_key", refundKey);
            return new Response(JSON.stringify({ error: "balance refund failed" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log(`[REFUND] Credits refunded for ${orderId}: +${order.photos_count}, new balance=${newBal}`);
        }
      }

      await supabase
        .from("orders")
        .update({ payment_status: "refunded" })
        .eq("id", orderId)
        .neq("payment_status", "refunded");

      return new Response(JSON.stringify({
        ok: true,
        method: "credits",
        amountRefunded: order.photos_count,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === PATH B: YOOKASSA REFUND ===
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      console.error(`[REFUND] YooKassa not configured — cannot refund money order ${orderId}`);
      return new Response(JSON.stringify({ error: "YooKassa not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.payment_id) {
      console.error(`[REFUND] Order ${orderId} missing payment_id`);
      return new Response(JSON.stringify({ error: "missing payment_id" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // YooKassa Refund API
    // Idempotence-Key — same per order so retries don't duplicate refunds.
    const credentials = btoa(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`);
    const refundBody = {
      payment_id: order.payment_id,
      amount: {
        value: Number(order.price).toFixed(2),
        currency: "RUB",
      },
      description: `Автовозврат за неуспешную генерацию заказа ${orderId}`,
    };

    const yooRes = await fetch("https://api.yookassa.ru/v3/refunds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
        "Idempotence-Key": refundKey,
      },
      body: JSON.stringify(refundBody),
    });

    const yooData = await yooRes.json();

    if (!yooRes.ok) {
      // YooKassa returns 400 if refund already exists — treat as success
      const alreadyRefunded =
        yooData?.code === "duplicated_request" ||
        yooData?.description?.toLowerCase?.().includes("already");

      if (!alreadyRefunded) {
        console.error(`[REFUND] YooKassa refund failed for ${orderId}:`, JSON.stringify(yooData));
        return new Response(JSON.stringify({ error: "YooKassa refund failed", details: yooData }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[REFUND] YooKassa says already refunded — flipping status`);
    } else {
      console.log(`[REFUND] YooKassa refund OK for ${orderId}: refund_id=${yooData.id} status=${yooData.status}`);
    }

    await supabase
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId)
      .neq("payment_status", "refunded");

    return new Response(JSON.stringify({
      ok: true,
      method: "yookassa",
      amountRefunded: order.price,
      refundId: yooData?.id ?? null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[REFUND] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      tariffId, price, photosCount, userSessionId,
      styleIds, originalImageUrl, customPrompt, isFullBody, customerKey
    } = await req.json();

    // Validate required fields
    if (!tariffId || !photosCount || !userSessionId || !customerKey) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check credit balance
    const { data: account } = await supabase
      .from("credit_accounts")
      .select("id, balance")
      .eq("customer_key", customerKey.trim().toLowerCase())
      .single();

    if (!account || account.balance < photosCount) {
      return new Response(JSON.stringify({
        error: "Недостаточно кредитов",
        balance: account?.balance ?? 0,
        required: photosCount,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load check (same as create-payment)
    const { count: activeCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("generation_status", "running")
      .eq("payment_status", "succeeded");

    const LOAD_LIMITS: Record<string, number> = { basic: 50, standard: 25, premium: 10 };
    const maxActive = LOAD_LIMITS[tariffId] ?? 10;
    if ((activeCount ?? 0) >= maxActive) {
      return new Response(JSON.stringify({
        error: "Сервис временно перегружен, попробуйте через несколько минут"
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Create order (already paid via credits)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_session_id: userSessionId,
        tariff_id: tariffId,
        photos_count: photosCount,
        price: 0, // paid with credits, no money
        style_ids: styleIds || [],
        original_image: originalImageUrl || null,
        custom_prompt: customPrompt || null,
        is_full_body: isFullBody || false,
        payment_status: "succeeded", // already paid via credits
        generation_status: "running",
        customer_key: customerKey,
        payment_id: "credits_" + crypto.randomUUID(),
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

    // 4. Debit credits (idempotent)
    const debitKey = `debit_credits_${orderId}`;
    const { error: txErr } = await supabase
      .from("credit_transactions")
      .insert({
        account_id: account.id,
        order_id: orderId,
        type: "debit",
        amount: photosCount,
        idempotency_key: debitKey,
        description: `Списание за заказ ${tariffId} (${photosCount} фото)`,
      });

    if (txErr) {
      // If idempotency conflict, order was already debited — that's fine
      if (txErr.code === "23505") {
        console.log("Debit already exists, skipping");
      } else {
        console.error("Debit error:", txErr);
        // Rollback order
        await supabase.from("orders").delete().eq("id", orderId);
        return new Response(JSON.stringify({ error: "Ошибка списания кредитов" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Update balance
      await supabase
        .from("credit_accounts")
        .update({ balance: account.balance - photosCount })
        .eq("id", account.id);
    }

    // 5. Trigger generation (call generate-photo internally)
    console.log(`Credit order ${orderId} created, triggering generation`);

    // Fire generation in background (same as webhook does)
    const generatePayload = {
      orderId,
      styleIds: styleIds || [],
      originalImageUrl: originalImageUrl || null,
      customPrompt: customPrompt || null,
      isFullBody: isFullBody || false,
      photosCount,
      tariffId,
      customerKey,
    };

    // Trigger generation asynchronously via edge function
    fetch(`${SUPABASE_URL}/functions/v1/generate-photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(generatePayload),
    }).catch(err => console.error("Generation trigger error:", err));

    return new Response(JSON.stringify({
      orderId,
      paidWithCredits: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("pay-with-credits error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

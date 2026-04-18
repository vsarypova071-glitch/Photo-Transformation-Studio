// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// STAGE 2.2: Resume oldest reachable paid order for a customer_key.
// Used when user returns to the app and `current_order_id` is missing
// from localStorage (cleared cache, new browser, etc).
// Returns the most recent succeeded order in the last 24h that still
// has reachable state (done with results, running, waiting, or error).

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const customerKey = url.searchParams.get("customer_key");

    if (!customerKey || !customerKey.startsWith("cust_")) {
      return new Response(JSON.stringify({ error: "valid customer_key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, payment_status, generation_status, results, photos_count, tariff_id, created_at, updated_at")
      .eq("customer_key", customerKey)
      .eq("payment_status", "succeeded")
      .in("generation_status", ["done", "running", "waiting", "error"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("find-recent-order query error:", error.message);
      return new Response(JSON.stringify({ error: "query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For 'done' orders: only return if results actually exist
    const hasResults = Array.isArray(order.results) && order.results.length > 0;
    if (order.generation_status === "done" && !hasResults) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      found: true,
      orderId: order.id,
      paymentStatus: order.payment_status,
      generationStatus: order.generation_status,
      results: order.results || [],
      photosCount: order.photos_count,
      tariffId: order.tariff_id,
      createdAt: order.created_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("find-recent-order error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

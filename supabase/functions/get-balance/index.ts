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
    const url = new URL(req.url);
    const customerKey = (url.searchParams.get("customer_key") || "").trim().toLowerCase();

    if (!customerKey) {
      return new Response(JSON.stringify({ balance: 0, exists: false, accountId: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account } = await supabase
      .from("credit_accounts")
      .select("id, balance")
      .eq("customer_key", customerKey)
      .maybeSingle();

    return new Response(JSON.stringify({
      balance: account?.balance ?? 0,
      exists: !!account,
      accountId: account?.id ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("get-balance error:", err.message);
    return new Response(JSON.stringify({ balance: 0, exists: false, accountId: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
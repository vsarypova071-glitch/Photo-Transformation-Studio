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

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

    // 1. Expire pending orders older than 10 minutes
    const { data: expiredOrders, error: expireError } = await supabase
      .from("orders")
      .update({ payment_status: "expired", generation_status: "canceled" })
      .eq("payment_status", "pending")
      .eq("generation_status", "waiting")
      .lt("created_at", tenMinutesAgo)
      .select("id");

    const expiredCount = expiredOrders?.length ?? 0;
    if (expireError) console.error("Expire error:", expireError.message);
    else if (expiredCount > 0) console.log(`Expired ${expiredCount} stale orders`);

    // 2. Delete storage photos for orders expired > 20 minutes ago
    const { data: oldExpired, error: fetchError } = await supabase
      .from("orders")
      .select("id, original_image, updated_at")
      .eq("payment_status", "expired")
      .lt("updated_at", twentyMinutesAgo)
      .not("original_image", "is", null);

    if (fetchError) {
      console.error("Fetch expired orders error:", fetchError.message);
    }

    let deletedPhotos = 0;
    if (oldExpired && oldExpired.length > 0) {
      for (const order of oldExpired) {
        const imageUrl = order.original_image as string;
        // Extract path from storage URL: .../user-photos/filename
        const match = imageUrl.match(/\/user-photos\/(.+)$/);
        if (match) {
          const filePath = match[1];
          const { error: delError } = await supabase.storage
            .from("user-photos")
            .remove([filePath]);

          if (delError) {
            console.error(`Failed to delete ${filePath}:`, delError.message);
          } else {
            deletedPhotos++;
          }
        }

        // Clear the image reference
        await supabase
          .from("orders")
          .update({ original_image: null })
          .eq("id", order.id);
      }
      console.log(`Deleted ${deletedPhotos} temp photos from storage`);
    }

    return new Response(
      JSON.stringify({ expired: expiredCount, photosDeleted: deletedPhotos }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Cleanup error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

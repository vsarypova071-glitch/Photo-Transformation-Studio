// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit in deep navy",
  "bespoke structured blazer in forest green premium cashmere",
  "silk blouse in ivory with high-waist charcoal trousers",
  "architectural couture coat in camel",
  "luxury power suit in slate gray, precision tailoring",
];

function getRandomGarment(exclude: string[] = []): string {
  const available = WARDROBE.filter(g => !exclude.includes(g));
  return available[Math.floor(Math.random() * available.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, garment: string): string {
  return `You are a forensic portrait compositor. Place THIS EXACT FACE into a new fashion scene.

PRIORITY: 1) Face geometry lock 2) Identity lock 3) Style creative freedom

OUTFIT: ${garment}
BACKGROUND: Luxury studio — warm gray / ivory
LIGHTING: Large octabox 45°, rim/hair light, catchlights in eyes
POSE: Confident editorial, magnetic soft gaze
CAMERA: 85mm f/2.0, eye-level, zero distortion
FILM: Kodak Portra 800

${stylePrompt ? `Style: ${stylePrompt}` : ""}
${customPrompt ? `Note: ${customPrompt}` : ""}

CRITICAL: Preserve exact face geometry — jaw width, chin shape, cheek volume. No slimming.`;
}

async function generateSingle(imageBase64: string, stylePrompt: string, customPrompt: string, garment: string): Promise<string | null> {
  const prompt = buildPrompt(stylePrompt, customPrompt, garment);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
        ],
      }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    console.error(`AI error ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const body = await req.json();
    
    // YooKassa sends { type: "notification", event: "payment.succeeded", object: {...} }
    const event = body.event;
    const payment = body.object;

    if (!payment || !payment.id) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Webhook received: ${event}, payment ${payment.id}, status ${payment.status}`);

    const orderId = payment.metadata?.order_id;
    if (!orderId) {
      console.error("No order_id in payment metadata");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (event === "payment.succeeded" && payment.status === "succeeded") {
      // Check if order was expired before payment came through
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", orderId)
        .single();

      if (existingOrder?.payment_status === "expired") {
        console.log(`Order ${orderId} already expired, but payment succeeded — restoring`);
      }

      // Update order payment status (works for both pending and expired)
      await supabase
        .from("orders")
        .update({ payment_status: "succeeded", generation_status: "running" })
        .eq("id", orderId);

      console.log(`Order ${orderId} marked as paid, starting generation...`);

      // Fetch order details
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!order || !order.original_image) {
        console.error("Order not found or no image");
        await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Fetch image from storage URL and convert to base64
      let imageBase64: string;
      try {
        const imgResp = await fetch(order.original_image);
        if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status}`);
        const imgBuf = await imgResp.arrayBuffer();
        const uint8 = new Uint8Array(imgBuf);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        imageBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
        console.log(`Image fetched from storage, size: ${uint8.length} bytes`);
      } catch (imgErr: any) {
        console.error("Failed to fetch image from storage:", imgErr.message);
        await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Generate photos
      try {
        const count = Math.min(order.photos_count, 3);
        const garments: string[] = [];
        for (let i = 0; i < count; i++) {
          garments.push(getRandomGarment(garments));
        }

        const stylePrompt = order.style_ids?.length > 0
          ? order.style_ids.join(", ")
          : "Luxury fashion portrait photography";

        const promises = garments.map(g =>
          generateSingle(imageBase64, stylePrompt, order.custom_prompt || "", g)
        );

        const results = await Promise.all(promises);
        const imageUrls = results.filter(Boolean) as string[];

        if (imageUrls.length === 0) {
          await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
          console.error("No images generated");
        } else {
          await supabase
            .from("orders")
            .update({ generation_status: "done", results: imageUrls })
            .eq("id", orderId);
          console.log(`Order ${orderId}: ${imageUrls.length} photos generated`);
        }
      } catch (genErr: any) {
        console.error("Generation error:", genErr.message);
        await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
      }

    } else if (event === "payment.canceled") {
      await supabase
        .from("orders")
        .update({ payment_status: "canceled" })
        .eq("id", orderId);
      console.log(`Order ${orderId} payment canceled`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

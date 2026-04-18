// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const PER_CALL_TIMEOUT_MS = 60000;
const MAX_TOTAL_TIME = 180000;
const GENERATED_BUCKET = "user-photos"; // используем уже существующий bucket

async function generateSingle(
  imageBase64: string,
  prompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveGeneratedImageToStorage(
  supabase: any,
  externalImageUrl: string,
  orderId: string,
  index: number
): Promise<string | null> {
  try {
    const response = await fetch(externalImageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const path = `generated/${orderId}/${Date.now()}-${index}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(GENERATED_BUCKET)
      .upload(path, blob, {
        contentType: blob.type || `image/${ext}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("UPLOAD ERROR:", uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(GENERATED_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("SAVE TO STORAGE ERROR:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const payment = body.object;
    const orderId = payment?.metadata?.order_id;

    if (!orderId) {
      return new Response("OK", { status: 200 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) {
      return new Response("OK", { status: 200 });
    }

    if (["running", "done", "error"].includes(order.generation_status)) {
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("orders")
      .update({
        payment_status: "succeeded",
        generation_status: "running",
      })
      .eq("id", orderId)
      .not("generation_status", "in", '("done","error")');

    let imageBase64: string;
    try {
      const resp = await fetch(order.original_image);
      const buf = await resp.arrayBuffer();
      imageBase64 = `data:image/jpeg;base64,${btoa(
        String.fromCharCode(...new Uint8Array(buf))
      )}`;
    } catch {
      await supabase
        .from("orders")
        .update({ generation_status: "error" })
        .eq("id", orderId)
        .not("generation_status", "in", '("done","error")');

      return new Response("OK", { status: 200 });
    }

    const runGeneration = async () => {
      const startTime = Date.now();
      const results: string[] = [];

      const finalize = async (status: "done" | "error") => {
        await supabase
          .from("orders")
          .update({
            generation_status: status,
            results,
          })
          .eq("id", orderId)
          .not("generation_status", "in", '("done","error")');
      };

      try {
        const total = order.photos_count || 3;
        const basePrompt =
          order.custom_prompt ||
          "Luxury portrait photography, premium studio quality";

        for (let i = 0; i < total; i++) {
          if (Date.now() - startTime > MAX_TOTAL_TIME) {
            console.error("GLOBAL TIMEOUT");
            await finalize("error");
            return;
          }

          const variedPrompt = `${basePrompt}. Create variant ${i + 1} of ${total}. Make it visually distinct from the others: different pose, framing, mood, styling details, and composition.`;

          const externalUrl = await generateSingle(imageBase64, variedPrompt);

          if (!externalUrl) continue;

          // Сохраняем картинку в НАШ storage и только потом пишем в results
          const stableUrl = await saveGeneratedImageToStorage(
            supabase,
            externalUrl,
            orderId,
            i + 1
          );

          if (!stableUrl) continue;

          results.push(stableUrl);

          await supabase
            .from("orders")
            .update({ results })
            .eq("id", orderId)
            .not("generation_status", "in", '("done","error")');
        }

        if (results.length !== total) {
          await finalize("error");
        } else {
          await finalize("done");
        }
      } catch (e) {
        console.error("GEN ERROR", e);
        await finalize("error");
      }
    };

    runGeneration();

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    return new Response("OK", { status: 200 });
  }
});

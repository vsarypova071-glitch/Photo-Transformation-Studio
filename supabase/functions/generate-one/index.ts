// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PER_CALL_TIMEOUT_MS = 90000; // 90 сек на одно фото

// 🔥 STAGE WALLET 1.3: одиночная генерация по 1 кредиту
// Принцип 152-ФЗ: фото НЕ сохраняется на сервере.
// Возвращается клиенту в ответе как data:image/...;base64,...
// В БД — только метаданные в таблице generations.

const WARDROBE: string[] = [
  "custom tailored minimalist wool suit in deep navy",
  "bespoke structured blazer in forest green premium cashmere",
  "silk blouse in ivory with high-waist charcoal trousers",
  "architectural couture coat in camel",
  "luxury power suit in slate gray, precision tailoring",
  "oversized cashmere coat in off-white, The Row aesthetic",
  "structured leather blazer in cognac brown",
  "silk midi dress in deep burgundy with architectural draping",
  "wide-leg trousers in charcoal with ivory cashmere turtleneck",
  "blazer dress in midnight blue, sharp structured shoulders",
];

function pickGarment(): string {
  return WARDROBE[Math.floor(Math.random() * WARDROBE.length)];
}

function buildPrompt(
  stylePrompt: string,
  customPrompt: string,
  isFullBody: boolean,
  aspectRatio?: string
): string {
  const garment = pickGarment();
  const fullBodyHint = isFullBody
    ? "Full body composition: include subject from head to feet."
    : "Portrait composition: head and shoulders, magazine cover style.";

  return `Ultra-photorealistic editorial portrait. Preserve the subject's exact facial identity, geometry of nose, lips, eyes and skin texture from the reference photo (no slimming, no reshaping). Eyes: vivid, with soft catchlights and subtle wet sheen, slight 5° downward gaze for elegance.

${fullBodyHint}
OUTFIT: ${garment}.

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional note: ${customPrompt}` : ""}
${aspectRatio ? `Aspect ratio: ${aspectRatio}` : ""}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = PER_CALL_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

Deno.serve(async (req: Request) => {
  console.log(`[GEN-ONE] ▶ ${req.method} at ${new Date().toISOString()}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let generationId: string | null = null;
  let accountId: string | null = null;
  let debited = false;

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service not configured");
    }

    const body = await req.json();
    const {
      customer_key,
      style_id,
      style_prompt,
      original_image_url,
      custom_prompt,
      is_full_body,
      original_dimensions,
    } = body;

    // === Валидация ===
    if (!customer_key || typeof customer_key !== "string") {
      return new Response(JSON.stringify({ error: "customer_key required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!style_id || typeof style_id !== "string") {
      return new Response(JSON.stringify({ error: "style_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!original_image_url || typeof original_image_url !== "string") {
      return new Response(JSON.stringify({ error: "original_image_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerKey = customer_key.trim().toLowerCase();
    console.log(`[GEN-ONE] customer=${customerKey} style=${style_id} fullBody=${!!is_full_body}`);

    // === 1. Получаем credit_account ===
    const { data: account, error: accErr } = await supabase
      .from("credit_accounts")
      .select("id, balance")
      .eq("customer_key", customerKey)
      .maybeSingle();

    if (accErr) {
      console.error(`[GEN-ONE] ❌ Account lookup failed:`, accErr.message);
      return new Response(JSON.stringify({ error: "Account lookup failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account || account.balance < 1) {
      console.warn(`[GEN-ONE] ⚠ Insufficient balance for ${customerKey}: ${account?.balance ?? 0}`);
      return new Response(JSON.stringify({
        error: "Недостаточно кредитов",
        balance: account?.balance ?? 0,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    accountId = account.id;

    // === 2. Создаём generations row (status=running) ===
    const { data: gen, error: genErr } = await supabase
      .from("generations")
      .insert({
        customer_key: customerKey,
        style_id,
        status: "running",
        is_full_body: !!is_full_body,
        custom_prompt: custom_prompt || null,
      })
      .select("id")
      .single();

    if (genErr || !gen) {
      console.error(`[GEN-ONE] ❌ Failed to create generation row:`, genErr?.message);
      return new Response(JSON.stringify({ error: "Failed to create generation" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    generationId = gen.id;
    console.log(`[GEN-ONE] Created generation ${generationId}`);

    // === 3. Идемпотентное списание 1 кредита ===
    const debitKey = `debit_gen_${generationId}`;
    const { error: txErr } = await supabase
      .from("credit_transactions")
      .insert({
        account_id: accountId,
        type: "debit",
        amount: 1,
        idempotency_key: debitKey,
        description: `Генерация фото (стиль ${style_id})`,
      });

    if (txErr) {
      if (txErr.code !== "23505") {
        console.error(`[GEN-ONE] ❌ Debit tx insert failed:`, txErr.message);
        await supabase.from("generations")
          .update({ status: "error", error_message: "Debit transaction failed" })
          .eq("id", generationId);
        return new Response(JSON.stringify({ error: "Ошибка списания кредитов" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // 23505 = дубликат → уже списано, идём дальше
    } else {
      // Атомарно списываем баланс
      const { data: newBalance, error: debErr } = await supabase
        .rpc("debit_balance", { p_account_id: accountId, p_amount: 1 });

      if (debErr || newBalance === -1) {
        console.error(`[GEN-ONE] ❌ Atomic debit failed`);
        await supabase.from("credit_transactions").delete().eq("idempotency_key", debitKey);
        await supabase.from("generations")
          .update({ status: "error", error_message: "Insufficient balance (atomic check)" })
          .eq("id", generationId);
        return new Response(JSON.stringify({
          error: "Недостаточно кредитов",
          balance: account.balance,
        }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      debited = true;
      console.log(`[GEN-ONE] ✅ Debited 1 credit, new balance: ${newBalance}`);
    }

    // Обновляем generations с debit_tx_id
    const { data: txRow } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("idempotency_key", debitKey)
      .single();

    if (txRow) {
      await supabase
        .from("generations")
        .update({ debit_tx_id: txRow.id })
        .eq("id", generationId);
    }

    // === 4. Загружаем исходное фото ===
    let imageBase64: string;
    try {
      const resp = await fetchWithTimeout(original_image_url, { method: "GET" }, 30000);
      if (!resp.ok) throw new Error(`Image fetch ${resp.status}`);
      const buf = await resp.arrayBuffer();
      // Безопасная конвертация больших буферов в base64 (без spread)
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      imageBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (e: any) {
      console.error(`[GEN-ONE] ❌ Image fetch failed:`, e.message);
      throw new Error("Не удалось загрузить исходное фото");
    }

    // === 5. Aspect ratio ===
    let aspectRatio: string | undefined;
    if (original_dimensions?.width && original_dimensions?.height) {
      const w = original_dimensions.width;
      const h = original_dimensions.height;
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const d = gcd(w, h);
      aspectRatio = `${w / d}:${h / d}`;
    }

    // === 6. Вызов Lovable AI Gateway ===
    const fullPrompt = buildPrompt(
      style_prompt || "",
      custom_prompt || "",
      !!is_full_body,
      aspectRatio
    );

    console.log(`[GEN-ONE] Calling AI gateway, prompt length=${fullPrompt.length}`);

    const aiResp = await fetchWithTimeout(
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
                { type: "text", text: fullPrompt },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[GEN-ONE] ❌ AI gateway ${aiResp.status}:`, errText.slice(0, 300));

      // Возвращаем кредит
      if (debited) {
        await supabase.rpc("refund_balance", { p_account_id: accountId, p_amount: 1 });
        await supabase.from("credit_transactions").insert({
          account_id: accountId,
          type: "refund",
          amount: 1,
          idempotency_key: `refund_gen_${generationId}`,
          description: `Возврат за неудачную генерацию ${generationId}`,
        });
        console.log(`[GEN-ONE] 💰 Credit refunded`);
      }
      await supabase.from("generations")
        .update({ status: "error", error_message: `AI ${aiResp.status}` })
        .eq("id", generationId);

      // Особые статусы для UX
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({
          error: "Слишком много запросов, попробуйте через минуту",
          refunded: true,
        }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({
          error: "Сервис временно недоступен. Кредит возвращён.",
          refunded: true,
        }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        error: "Не удалось сгенерировать фото. Кредит возвращён.",
        refunded: true,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const imageUrl: string | undefined =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error(`[GEN-ONE] ❌ No image in AI response`);
      if (debited) {
        await supabase.rpc("refund_balance", { p_account_id: accountId, p_amount: 1 });
        await supabase.from("credit_transactions").insert({
          account_id: accountId,
          type: "refund",
          amount: 1,
          idempotency_key: `refund_gen_${generationId}`,
          description: `Возврат: пустой ответ AI`,
        });
      }
      await supabase.from("generations")
        .update({ status: "error", error_message: "No image in AI response" })
        .eq("id", generationId);

      return new Response(JSON.stringify({
        error: "AI не вернул фото. Кредит возвращён.",
        refunded: true,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === 7. Успех — сохраняем результат в Storage и отдаём HTTPS URL ===
    let publicUrl: string;
    try {
      const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) throw new Error("AI returned non-data-url image");
      const mime = match[1];
      const b64 = match[2];
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

      // base64 → Uint8Array
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const filePath = `results/${customerKey}/${generationId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("user-photos")
        .upload(filePath, bytes, { contentType: mime, upsert: true });

      if (upErr) throw new Error("Storage upload failed: " + upErr.message);

      const { data: pub } = supabase.storage.from("user-photos").getPublicUrl(filePath);
      publicUrl = pub.publicUrl;
      console.log(`[GEN-ONE] ✅ Result saved to storage: ${publicUrl}`);
    } catch (e: any) {
      console.error(`[GEN-ONE] ❌ Failed to save result to storage:`, e.message);
      // Возвращаем кредит — юзер не должен платить за фото, которое мы не смогли сохранить
      if (debited) {
        await supabase.rpc("refund_balance", { p_account_id: accountId, p_amount: 1 });
        await supabase.from("credit_transactions").insert({
          account_id: accountId,
          type: "refund",
          amount: 1,
          idempotency_key: `refund_gen_${generationId}`,
          description: `Возврат: не удалось сохранить результат`,
        });
      }
      await supabase.from("generations")
        .update({ status: "error", error_message: ("Storage upload failed: " + e.message).slice(0, 500) })
        .eq("id", generationId);
      return new Response(JSON.stringify({
        error: "Не удалось сохранить фото. Кредит возвращён.",
        refunded: true,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("generations")
      .update({ status: "done" })
      .eq("id", generationId);

    console.log(`[GEN-ONE] ✅ Generation ${generationId} done — returning HTTPS url`);

    // Получаем актуальный баланс для UI
    const { data: finalAcc } = await supabase
      .from("credit_accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    return new Response(JSON.stringify({
      generation_id: generationId,
      image_url: publicUrl,
      balance: finalAcc?.balance ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[GEN-ONE] ❌ FATAL:`, err.message);

    // Пытаемся вернуть кредит если он был списан
    if (debited && accountId && generationId) {
      try {
        await supabase.rpc("refund_balance", { p_account_id: accountId, p_amount: 1 });
        await supabase.from("credit_transactions").insert({
          account_id: accountId,
          type: "refund",
          amount: 1,
          idempotency_key: `refund_gen_${generationId}`,
          description: `Возврат: фатальная ошибка`,
        });
        await supabase.from("generations")
          .update({ status: "error", error_message: err.message?.slice(0, 500) })
          .eq("id", generationId);
        console.log(`[GEN-ONE] 💰 Credit refunded (fatal path)`);
      } catch (refErr: any) {
        console.error(`[GEN-ONE] ❌ Failed to refund on fatal:`, refErr.message);
      }
    }

    return new Response(JSON.stringify({
      error: err.message || "Unknown error",
      refunded: debited,
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

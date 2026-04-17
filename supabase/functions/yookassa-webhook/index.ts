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
  "oversized cashmere coat in off-white, The Row aesthetic",
  "structured leather blazer in cognac brown",
  "silk midi dress in deep burgundy with architectural draping",
  "wide-leg trousers in charcoal with ivory cashmere turtleneck",
  "blazer dress in midnight blue, sharp structured shoulders",
];

function getRandomGarment(exclude: string[] = []): string {
  const available = WARDROBE.filter(g => !exclude.includes(g));
  return available[Math.floor(Math.random() * available.length)];
}

function buildPrompt(stylePrompt: string, customPrompt: string, garment: string): string {
  return `You are a forensic portrait compositor. Your task: place THIS EXACT FACE into a new fashion scene.
The face is a locked asset. Only the environment changes.

PRIORITY ORDER (strict):
1. GEOMETRY LOCK — face proportions, jaw width, chin shape → ABSOLUTE PRIORITY
2. IDENTITY LOCK — eyes, nose, lips, skin texture → PRESERVE EXACTLY
3. STYLE — outfit, background, lighting → CREATIVE FREEDOM ONLY HERE

══════════════════════════════════════════════════
PHASE 1: GEOMETRY SCAN (face as biometric data)
══════════════════════════════════════════════════

Before doing anything else, extract and record these measurements from the source photo:

[FACE GEOMETRY — LOCK ALL VALUES]

▸ FACE OVAL:
  → Total face width (ear to ear at widest point)
  → Face width at temple level
  → Face width at cheekbone level
  → Face width at jawline level ← MOST CRITICAL
  → Face width-to-height ratio

▸ JAW GEOMETRY (⚠️ PRIMARY DRIFT ZONE — AI slims jaw by default 15–25%):
  → Jaw width (L jaw corner to R jaw corner) — measure in source, LOCK THIS NUMBER
  → Jaw width / IPD ratio — record exact ratio, result MUST be identical
  → Jaw angle: where jaw meets neck — COPY EXACTLY
  → Jaw shape: square / tapered / round — COPY EXACTLY, DO NOT TAPER
  → ⛔ FORBIDDEN: creating V-shape where source has flat/round jaw

▸ CHIN GEOMETRY:
  → Chin width — MEASURE AND LOCK
  → Chin shape: rounded / square / soft-square / slightly-pointed — COPY EXACTLY
  → ⛔ If source chin is ROUNDED or SQUARE → result MUST be ROUNDED or SQUARE
  → ⛔ FORBIDDEN: converting rounded/soft chin to pointed/sharp chin

▸ CHEEK VOLUME:
  → Volume level: hollow / medium / full — COPY EXACTLY
  → Cheekbone prominence: subtle / medium / pronounced
  → ⛔ DO NOT reduce cheek volume if source has full cheeks
  → ⛔ DO NOT add volume if source has hollow cheeks

▸ LOWER THIRD PROPORTIONS (nose base → chin tip):
  → Width ratio at jawline vs cheekbones
  → ⛔ If source lower third is wide → result MUST be wide. No tapering.

[RECORD ALL VALUES ABOVE BEFORE GENERATING]

══════════════════════════════════════════════════
PHASE 2: IDENTITY SCAN (face as person)
══════════════════════════════════════════════════

▸ EYES:
  → Exact iris color (be specific: sage-green / amber-hazel / storm-grey, not just "brown")
  → Eye spacing: narrow / average / wide — THIS IS BONE
  → Eyelid shape: heavy lid / visible crease / deep-set / almond
  → Natural lash density — DO NOT add theatrical lashes
  → CATCHLIGHTS: round specular highlight in each iris, upper quadrant — MANDATORY
  → EYE MOISTURE: subtle wet sheen on sclera — alive, not bloodshot
  → GAZE: soft and magnetic, slightly dreamy, 5° downward tilt — NOT passport stare

▸ NOSE:
  → Bridge width: narrow / medium / wide
  → Tip shape: rounded / pointed / bulbous / upturned
  → ⛔ DO NOT refine, narrow or alter nose shape

▸ LIPS:
  → Fullness: thin / medium / full
  → Shape: defined cupid's bow / soft / straight upper lip
  → ⛔ DO NOT enlarge or reshape

▸ SKIN:
  → Tone: note undertone (warm / cool / neutral)
  → Texture: real skin — pores, natural variation
  → ⛔ NO airbrushing, NO plastic skin, NO beauty filter texture

══════════════════════════════════════════════════
⛔ NEGATIVE PROMPT — STRICTLY FORBIDDEN
══════════════════════════════════════════════════

GEOMETRY FORBIDDEN:
slim face, narrow jaw, v-shape face, v-shape jaw, narrow lower face, tapering jaw,
face slimming, jawline contouring, chiseled jaw, sculpted jaw, defined jawline,
pointed chin, sharp chin, narrow chin, V-chin, narrowed lower third, compressed jaw width,
reduced chin width, face restructuring, altered facial structure, narrowed face,
thinner face, supermodel jaw, editorial jaw proportions, fashion face geometry

IDENTITY FORBIDDEN:
model face, beautified face, idealized face, perfect skin, airbrushed skin,
beauty filter face, beautification filter, perfect oval face, supermodel proportions,
slimmed cheeks (if source has full), filled cheeks (if source has hollow)

══════════════════════════════════════════════════
PHASE 3: BUILD SCENE (creative freedom only here)
══════════════════════════════════════════════════

Place the EXACT LOCKED FACE into a new professional setting:

OUTFIT: ${garment}

BACKGROUND: Luxury studio — warm gray / ivory / soft taupe
⚠️ MANDATORY: Background MUST contrast with outfit — not similar tones

LIGHTING:
• Large octabox 45° — sculpts without flattening
• Rim/hair light — depth, separation from background
• Minimal fill — preserve natural shadows under cheekbones
• CATCHLIGHTS (mandatory): round specular in each iris, upper quadrant
• Eye zone slightly brighter — draws viewer into gaze

POSE: Confident editorial — hand near face, slight head turn, magnetic soft gaze
CAMERA: 85mm f/2.0 — eye-level only, neutral perspective, zero distortion
⚠️ Forbidden: wide-angle (widens & distorts), low-angle (sharpens chin), any extreme angle
FILM: Kodak Portra 800 — warm, dimensional, natural skin tones

MAKEUP: Flattering for this specific skin tone
• Skin: real texture — NOT plastic or airbrushed
• Lips: warm nude / mauve / berry — ⛔ NEVER match outfit
• Lashes: naturally enhanced — ⛔ NO theatrical lashes
• Blush: high on cheekbones, warm tone

${stylePrompt ? `Style direction: ${stylePrompt}` : ""}
${customPrompt ? `Additional note: ${customPrompt}` : ""}

══════════════════════════════════════════════════
PHASE 4: DUAL VERIFICATION (geometry + identity)
══════════════════════════════════════════════════

Run both checks before rendering:

[GEOMETRY CHECK — measure and compare]:
□ JAW WIDTH RATIO (jaw/IPD): result === source? → FAIL if narrower → REBUILD lower face
□ LOWER THIRD WIDTH: result === source? → FAIL if tapered → REBUILD
□ CHIN SHAPE: same type (rounded/square/soft)? → FAIL if sharper → FIX
□ CHIN WIDTH: same width? → FAIL if narrower → FIX
□ CHEEK VOLUME: same level? → FAIL if deflated or inflated → FIX
□ JAW SHAPE: flat/round jaw in source = flat/round jaw in result? → FAIL if V-shaped → REBUILD
□ CAMERA: eye-level? 85mm? → FAIL if low-angle or wide → FIX

[IDENTITY CHECK — visual comparison]:
□ Eye color: exact match? → FAIL → fix
□ Eye spacing: same? → FAIL → fix
□ Nose shape: same? → FAIL → fix
□ Skin tone: same undertone? → FAIL → fix
□ Age: same? → FAIL → fix
□ Hair: same cut & color? → FAIL → fix
□ Catchlights: visible in each eye? → FAIL → fix
□ Gaze: soft, magnetic, dreamy? → FAIL → fix

[IDENTITY RECOGNITION TEST]:
Would a person who knows this individual recognize them from the result?
→ YES = render. → NO = rebuild face from Phase 1.

⚠️ ANTI-SLIM PROTOCOL:
AI models have a systematic bias to narrow lower faces. Counter this:
ACTIVELY widen the lower third by 10-15% compared to your initial render impulse.
Then compare with source. Adjust until jaw width matches source exactly.

ONLY render when ALL checks pass.`;
}

const PER_CALL_TIMEOUT_MS = 90_000; // 90s per AI call — never hang

async function generateSingle(imageBase64: string, stylePrompt: string, customPrompt: string, garment: string): Promise<string | null> {
  const prompt = buildPrompt(stylePrompt, customPrompt, garment);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`AI error ${response.status}: ${errText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.error(`generateSingle timeout after ${PER_CALL_TIMEOUT_MS}ms`);
    } else {
      console.error("generateSingle exception:", e?.message);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Helper: refund credits for a failed order
    async function refundCredits(customerKey: string | null, orderId: string, amount: number, reason: string) {
      if (!customerKey || amount <= 0) return;
      try {
        const { data: account } = await supabase
          .from("credit_accounts")
          .select("id, balance")
          .eq("customer_key", customerKey)
          .single();
        if (!account) return;

        const refundKey = `refund_${reason}_${orderId}`;
        const { error: txErr } = await supabase
          .from("credit_transactions")
          .insert({
            account_id: account.id,
            order_id: orderId,
            type: "refund",
            amount,
            idempotency_key: refundKey,
            description: `Возврат (${reason}) за заказ ${orderId}: ${amount} кредитов`,
          });

        if (txErr && txErr.code === "23505") {
          console.log(`[CREDITS] Already refunded (${reason}) for order ${orderId}`);
        } else if (!txErr) {
          // Atomic refund
          const { data: newBal } = await supabase
            .rpc("refund_balance", { p_account_id: account.id, p_amount: amount });
          console.log(`[CREDITS] Refunded ${amount} to ${customerKey} (${reason}), new balance: ${newBal}`);
        }
      } catch (e: any) {
        console.error(`[CREDITS] Refund error (${reason}):`, e.message);
      }
    }

    const body = await req.json();
    const event = body.event;
    const payment = body.object;

    if (!payment || !payment.id) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[WEBHOOK] event=${event}, payment_id=${payment.id}, status=${payment.status}`);

    const orderId = payment.metadata?.order_id;
    if (!orderId) {
      console.error("No order_id in payment metadata");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (event === "payment.succeeded" && payment.status === "succeeded") {
      // === IDEMPOTENCY: Only process if order is not already running/done ===
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("payment_status, generation_status, photos_count, customer_key, tariff_id, price")
        .eq("id", orderId)
        .single();

      if (!existingOrder) {
        console.error(`[WEBHOOK] Order ${orderId} not found in DB`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      console.log(`[WEBHOOK] Order ${orderId}: payment_status=${existingOrder.payment_status}, generation_status=${existingOrder.generation_status}, photos_count=${existingOrder.photos_count}`);

      // CRITICAL: verify payment before generation
      if (existingOrder.payment_status === "succeeded" && existingOrder.generation_status !== "waiting") {
        console.log(`[WEBHOOK] Order ${orderId} already in ${existingOrder.generation_status}, skipping`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      if (existingOrder.payment_status !== "succeeded" && payment.status !== "succeeded") {
        console.error(`[WEBHOOK] Order ${orderId}: payment NOT succeeded (${existingOrder.payment_status}), refusing generation`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // === CREDIT SYSTEM: Credit account after successful payment ===
      const customerKey = existingOrder.customer_key || payment.metadata?.customer_key;
      const customerEmail = payment.receipt?.customer?.email || null;

      if (customerKey) {
        try {
          // Upsert credit account
          let { data: account } = await supabase
            .from("credit_accounts")
            .select("id, balance")
            .eq("customer_key", customerKey)
            .single();

          if (!account) {
            const { data: newAccount } = await supabase
              .from("credit_accounts")
              .insert({ customer_key: customerKey, email: customerEmail, balance: 0 })
              .select("id, balance")
              .single();
            account = newAccount;
          } else if (customerEmail && !account.email) {
            await supabase
              .from("credit_accounts")
              .update({ email: customerEmail })
              .eq("id", account.id);
          }

          if (account) {
            const creditAmount = existingOrder.photos_count;
            const idempotencyKey = `credit_${payment.id}_${orderId}`;

            // Idempotent credit: skip if already credited
            const { error: txError } = await supabase
              .from("credit_transactions")
              .insert({
                account_id: account.id,
                order_id: orderId,
                type: "credit",
                amount: creditAmount,
                idempotency_key: idempotencyKey,
                description: `Оплата тарифа ${existingOrder.tariff_id}: ${creditAmount} кредитов`,
              });

            if (txError && txError.code === "23505") {
              console.log(`[CREDITS] Already credited for payment ${payment.id}, skipping`);
            } else if (txError) {
              console.error(`[CREDITS] Credit transaction error:`, txError);
            } else {
              // Atomic credit via refund_balance (same logic: balance + amount)
              const { data: newBal } = await supabase
                .rpc("refund_balance", { p_account_id: account.id, p_amount: creditAmount });
              console.log(`[CREDITS] Credited ${creditAmount} to ${customerKey}, new balance: ${newBal}`);
            }

            // === DEBIT credits before generation ===
            const debitKey = `debit_${orderId}`;
            const { error: debitTxError } = await supabase
              .from("credit_transactions")
              .insert({
                account_id: account.id,
                order_id: orderId,
                type: "debit",
                amount: creditAmount,
                idempotency_key: debitKey,
                description: `Списание за заказ ${orderId}: ${creditAmount} кредитов`,
              });

            if (debitTxError && debitTxError.code === "23505") {
              console.log(`[CREDITS] Already debited for order ${orderId}, skipping`);
            } else if (debitTxError) {
              console.error(`[CREDITS] Debit transaction error:`, debitTxError);
            } else {
              // Atomic debit with balance check
              const { data: newBalance, error: debitErr } = await supabase
                .rpc("debit_balance", { p_account_id: account.id, p_amount: creditAmount });

              if (debitErr || newBalance === -1) {
                console.error(`[CREDITS] Atomic debit failed for order ${orderId}`);
                await supabase.from("credit_transactions").delete().eq("idempotency_key", debitKey);
                await supabase.from("orders")
                  .update({ payment_status: "succeeded", generation_status: "error" })
                  .eq("id", orderId);
                return new Response("OK", { status: 200, headers: corsHeaders });
              }
              console.log(`[CREDITS] Debited ${creditAmount} from ${customerKey}, new balance: ${newBalance}`);
            }
          }
        } catch (creditErr: any) {
          console.error(`[CREDITS] Error processing credits:`, creditErr.message);
          // Don't block generation if credit system fails — log and continue
        }
      }

      // Update order payment status and start generation
      await supabase
        .from("orders")
        .update({ payment_status: "succeeded", generation_status: "running" })
        .eq("id", orderId);

      console.log(`[WEBHOOK] Order ${orderId}: payment verified, starting generation for ${existingOrder.photos_count} photos`);

      // Fetch full order details
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!order || !order.original_image) {
        console.error("Order not found or no image");
        await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
        await refundCredits(existingOrder.customer_key || payment.metadata?.customer_key, orderId, existingOrder.photos_count, "no_image");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Fetch image from storage
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
        console.log(`Image fetched, size: ${uint8.length} bytes`);
      } catch (imgErr: any) {
        console.error("Failed to fetch image:", imgErr.message);
        await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
        await refundCredits(order?.customer_key || existingOrder.customer_key, orderId, existingOrder.photos_count, "image_fetch");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // === GENERATE ALL PHOTOS in background — webhook returns 200 immediately ===
      const totalPhotos = order.photos_count;
      const BATCH_SIZE = 3;
      const MAX_RETRIES = 2;
      const stylePrompt = order.style_ids?.length > 0
        ? order.style_ids.join(", ")
        : "Luxury fashion portrait photography";
      const orderCustomerKey = order.customer_key;

      const runGeneration = async () => {
        const allImageUrls: string[] = [];
        const usedGarments: string[] = [];

        const persistResults = async () => {
          try {
            await supabase.from("orders").update({ results: allImageUrls }).eq("id", orderId);
          } catch (e: any) {
            console.error(`[GENERATION] persist error: ${e?.message}`);
          }
        };

        const nextGarment = () => {
          const g = getRandomGarment(usedGarments);
          usedGarments.push(g);
          if (usedGarments.length >= WARDROBE.length) usedGarments.length = 0;
          return g;
        };

        const finalize = async (label: string) => {
          try {
            if (allImageUrls.length >= totalPhotos) {
              allImageUrls.length = totalPhotos;
              await supabase.from("orders")
                .update({ generation_status: "done", results: allImageUrls })
                .eq("id", orderId);
              console.log(`[GENERATION] Order ${orderId}: DONE (${label}) — ${allImageUrls.length}/${totalPhotos}`);
            } else {
              await supabase.from("orders")
                .update({ generation_status: "error", results: allImageUrls })
                .eq("id", orderId);
              console.error(`[GENERATION] Order ${orderId}: ERROR (${label}) — ${allImageUrls.length}/${totalPhotos}`);
              await refundCredits(orderCustomerKey, orderId, totalPhotos, "partial_generation");
            }
          } catch (e: any) {
            console.error(`[GENERATION] finalize fatal: ${e?.message}`);
            try {
              await supabase.from("orders").update({ generation_status: "error" }).eq("id", orderId);
            } catch {}
          }
        };

        try {
          const totalRounds = 1 + MAX_RETRIES;
          for (let round = 0; round < totalRounds && allImageUrls.length < totalPhotos; round++) {
            const remaining = totalPhotos - allImageUrls.length;
            console.log(`[GENERATION] Order ${orderId}: round ${round + 1}/${totalRounds}, need ${remaining} more`);

            for (let i = 0; i < remaining && allImageUrls.length < totalPhotos; i += BATCH_SIZE) {
              const batchCount = Math.min(BATCH_SIZE, totalPhotos - allImageUrls.length);
              const garments = Array.from({ length: batchCount }, () => nextGarment());

              const settled = await Promise.allSettled(
                garments.map(g => generateSingle(imageBase64, stylePrompt, order.custom_prompt || "", g))
              );
              for (const s of settled) {
                if (s.status === "fulfilled" && s.value) {
                  allImageUrls.push(s.value);
                  if (allImageUrls.length >= totalPhotos) break;
                }
              }

              await persistResults();
              console.log(`[GENERATION] Order ${orderId}: ${allImageUrls.length}/${totalPhotos}`);
            }
          }
          await finalize("complete");
        } catch (e: any) {
          console.error(`[GENERATION] Order ${orderId}: exception — ${e?.message}`);
          await finalize("exception");
        }
      };

      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(runGeneration());
      } else {
        runGeneration().catch((e) => console.error("runGeneration unhandled:", e?.message));
      }

    } else if (event === "payment.canceled") {
      await supabase
        .from("orders")
        .update({ payment_status: "canceled", generation_status: "canceled" })
        .eq("id", orderId);
      console.log(`Order ${orderId} payment canceled`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

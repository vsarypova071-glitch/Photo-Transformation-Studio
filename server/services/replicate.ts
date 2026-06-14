// Клиент Replicate для identity-preserving портретов (InstantID).
//
// Зачем отдельно от openrouter.ts: Gemini получает фото как обычный image_url в
// chat-промпте — это style reference, без face-conditioning, поэтому лицо «плывёт».
// InstantID на Replicate принимает фото как ИДЕНТИЧНОСТЬ (face embedding + ControlNet)
// и держит геометрию лица. Стиль (одежда/фон/свет) накладывается поверх identity.
//
// Активируется только при заданном REPLICATE_API_TOKEN. Без токена модуль не
// используется — основной путь остаётся на OpenRouter/Gemini (см. generation.ts).
//
// API: https://replicate.com/zsxkib/instant-id
// Эндпоинт моделей с `Prefer: wait` возвращает результат синхронно (до ~60с),
// используя последнюю версию модели — version-hash хардкодить не нужно.

const MODEL_ENDPOINT = 'https://api.replicate.com/v1/models/zsxkib/instant-id/predictions';
const PER_CALL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

export class ReplicateError extends Error {
  status: number;
  code: string;
  detail?: unknown;
  constructor(message: string, status: number, code: string, detail?: unknown) {
    super(message);
    this.name = 'ReplicateError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export interface GeneratePortraitInput {
  /** data:image/...;base64,... либо http(s) URL — лицо пользователя (identity input). */
  faceImage: string;
  /** Короткий промпт стиля (одежда/фон/свет). НЕ огромный Gemini-промпт — SDXL CLIP не любит длинные. */
  prompt: string;
  negativePrompt: string;
  aspectRatio?: { width: number; height: number };
}

export interface GeneratePortraitResult {
  imageDataUrl: string;
  modelUsed: string;
}

export function isReplicateConfigured(): boolean {
  return !!(process.env.REPLICATE_API_TOKEN || '').trim();
}

function readToken(): string {
  const token = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (!token) {
    throw new ReplicateError('REPLICATE_API_TOKEN is not configured', 503, 'no_api_key');
  }
  return token;
}

/**
 * Identity-сила задаётся через env (чтобы крутить без передеплоя кода):
 *   REPLICATE_IDENTITYNET — controlnet_conditioning_scale (структура лица), дефолт 0.8
 *   REPLICATE_ADAPTER     — ip_adapter_scale (черты лица), дефолт 0.8
 * Выше = больше сходство. Слишком высоко (>1.3) — артефакты/пересатурация.
 */
function readScales(): { identitynet: number; adapter: number } {
  const num = (v: string | undefined, def: number) => {
    const n = Number((v || '').trim());
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    identitynet: num(process.env.REPLICATE_IDENTITYNET, 0.8),
    adapter: num(process.env.REPLICATE_ADAPTER, 0.8),
  };
}

// Replicate отдаёт output как массив URL (или одиночный URL). Скачиваем и
// нормализуем в data URL — generation.ts ожидает тот же формат, что у openrouter.
async function toDataUrl(output: unknown): Promise<string> {
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new ReplicateError('Replicate returned no image URL', 502, 'no_image_in_response', output);
  }
  const r = await fetch(url);
  if (!r.ok) {
    throw new ReplicateError(`Failed to fetch generated image: ${r.status}`, 502, 'image_fetch_failed');
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/png';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

export async function generatePortrait(input: GeneratePortraitInput): Promise<GeneratePortraitResult> {
  const token = readToken();
  const { identitynet, adapter } = readScales();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const resp = await fetch(MODEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Синхронный режим: ждём готовности до ~60с, затем вернётся текущее состояние.
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        input: {
          image: input.faceImage,
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
          // Identity-conditioning — главные ползунки сохранения лица.
          controlnet_conditioning_scale: identitynet,
          ip_adapter_scale: adapter,
          // Качество.
          num_inference_steps: 30,
          guidance_scale: 5,
          ...(input.aspectRatio
            ? { width: input.aspectRatio.width, height: input.aspectRatio.height }
            : {}),
        },
      }),
      signal: controller.signal,
    });

    let body: any = null;
    try { body = await resp.json(); } catch { /* non-JSON */ }

    if (!resp.ok) {
      const code = body?.detail ? 'replicate_error' : `http_${resp.status}`;
      const msg = body?.detail || `Replicate HTTP ${resp.status}`;
      throw new ReplicateError(msg, resp.status, String(code), body);
    }

    // С `Prefer: wait` обычно приходит уже succeeded. Если ещё processing — поллим.
    let prediction = body;
    const getUrl: string | undefined = prediction?.urls?.get;

    while (prediction && (prediction.status === 'starting' || prediction.status === 'processing')) {
      if (!getUrl) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pr = await fetch(getUrl, { headers: { 'Authorization': `Bearer ${token}` }, signal: controller.signal });
      prediction = await pr.json();
    }

    if (prediction?.status === 'failed' || prediction?.status === 'canceled') {
      throw new ReplicateError(
        `Replicate prediction ${prediction.status}: ${prediction?.error || 'unknown'}`,
        502, 'prediction_failed', prediction,
      );
    }

    if (prediction?.status !== 'succeeded') {
      throw new ReplicateError('Replicate did not finish in time', 504, 'timeout', prediction);
    }

    const imageDataUrl = await toDataUrl(prediction.output);
    return { imageDataUrl, modelUsed: 'replicate:zsxkib/instant-id' };
  } catch (e: any) {
    if (e instanceof ReplicateError) throw e;
    if (e?.name === 'AbortError') {
      throw new ReplicateError('Replicate timeout', 504, 'timeout');
    }
    throw new ReplicateError(e?.message || 'Replicate network error', 502, 'network', e);
  } finally {
    clearTimeout(t);
  }
}

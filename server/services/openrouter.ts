// Клиент OpenRouter для image-output моделей.
// Ключ и модель — только из env. Если ключа нет — выбрасываем именованную ошибку,
// чтобы роут вернул понятный 503 и сделал refund.

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PER_CALL_TIMEOUT_MS = 90_000;
// Дефолт — image-input + image-output модель Google через OpenRouter.
// Точное имя в каталоге OpenRouter может отличаться; конфигурируется через env.
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image-preview';

export class OpenRouterError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, status: number, code: string, detail?: unknown) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export interface GenerateImageInput {
  prompt: string;
  /** data:image/jpeg;base64,... либо http(s) URL */
  imageInput: string;
}

export interface GenerateImageResult {
  /** data:image/...;base64,... (готов к сохранению на диск) */
  imageDataUrl: string;
  modelUsed: string;
  rawTokens?: number;
}

function readConfig(): { apiKey: string; model: string } {
  const apiKey = (process.env.OPENROUTER_API_KEY ?? '').trim();
  const model = (process.env.OPENROUTER_MODEL ?? '').trim() || DEFAULT_MODEL;
  if (!apiKey) {
    throw new OpenRouterError(
      'OPENROUTER_API_KEY is not configured',
      503,
      'no_api_key',
    );
  }
  return { apiKey, model };
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const { apiKey, model } = readConfig();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter рекомендует эти заголовки для регистрации трафика.
        'HTTP-Referer': process.env.APP_URL || 'https://www.ai-fotosessia.ru',
        'X-Title': 'AI Fotosessia',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: input.prompt },
            { type: 'image_url', image_url: { url: input.imageInput } },
          ],
        }],
        modalities: ['image', 'text'],
      }),
      signal: controller.signal,
    });

    let body: any = null;
    try { body = await resp.json(); } catch { /* non-JSON */ }

    if (!resp.ok) {
      const code = body?.error?.code || `http_${resp.status}`;
      const msg = body?.error?.message || `OpenRouter HTTP ${resp.status}`;
      throw new OpenRouterError(msg, resp.status, String(code), body);
    }

    // OpenRouter chat-completions для multimodal моделей кладёт картинку либо в
    // message.images[0].image_url.url, либо в content[i].image_url.url —
    // проверяем оба варианта.
    const choice = body?.choices?.[0]?.message;
    let dataUrl: string | undefined =
      choice?.images?.[0]?.image_url?.url ||
      (Array.isArray(choice?.content)
        ? choice.content.find((p: any) => p?.type === 'image_url')?.image_url?.url
        : undefined);

    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new OpenRouterError(
        'OpenRouter did not return an image',
        502,
        'no_image_in_response',
        body,
      );
    }

    // Если URL не data:, а http — скачаем и нормализуем в data:.
    if (!dataUrl.startsWith('data:')) {
      const r = await fetch(dataUrl);
      if (!r.ok) {
        throw new OpenRouterError(
          `Failed to fetch generated image: ${r.status}`,
          502,
          'image_fetch_failed',
        );
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || 'image/jpeg';
      dataUrl = `data:${ct};base64,${buf.toString('base64')}`;
    }

    return {
      imageDataUrl: dataUrl,
      modelUsed: model,
      rawTokens: body?.usage?.total_tokens,
    };
  } catch (e: any) {
    if (e instanceof OpenRouterError) throw e;
    if (e?.name === 'AbortError') {
      throw new OpenRouterError('OpenRouter timeout', 504, 'timeout');
    }
    throw new OpenRouterError(e?.message || 'OpenRouter network error', 502, 'network', e);
  } finally {
    clearTimeout(t);
  }
}

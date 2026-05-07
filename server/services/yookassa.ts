import crypto from 'crypto';

const BASE = 'https://api.yookassa.ru/v3';

function readShopId(): string {
  const v = (process.env.YOOKASSA_SHOP_ID || '').trim();
  if (!v) throw new Error('YOOKASSA_SHOP_ID is not set');
  if (!/^\d+$/.test(v)) {
    throw new Error(`YOOKASSA_SHOP_ID must contain only digits (got "${v.slice(0, 4)}...", length ${v.length})`);
  }
  return v;
}

function readSecret(): string {
  const v = (process.env.YOOKASSA_SECRET_KEY || '').trim();
  if (!v) throw new Error('YOOKASSA_SECRET_KEY is not set');
  if (/\s/.test(v)) {
    throw new Error('YOOKASSA_SECRET_KEY contains whitespace — copy/paste error');
  }
  if (!v.startsWith('live_') && !v.startsWith('test_')) {
    console.warn('[yookassa] WARNING: secret does not start with "live_" or "test_". Check key format.');
  }
  return v;
}

function authHeader(): string {
  const creds = `${readShopId()}:${readSecret()}`;
  return 'Basic ' + Buffer.from(creds, 'utf-8').toString('base64');
}

export interface CreatePaymentParams {
  orderId: string;
  tariffId: string;
  photosCount: number;
  price: number;
  email: string;
  returnUrl: string;
  customerKey?: string | null;
}

export interface YooPayment {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value: string; currency: string };
  confirmation?: { confirmation_url?: string; type?: string };
  metadata?: Record<string, string>;
  description?: string;
}

interface YooErrorBody {
  type?: string;
  id?: string;
  code?: string;
  description?: string;
  parameter?: string;
}

export async function createPayment(p: CreatePaymentParams): Promise<YooPayment> {
  const body = {
    amount: { value: p.price.toFixed(2), currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: p.returnUrl },
    capture: true,
    description: `AI фотосессия — ${p.tariffId} (${p.photosCount} фото)`,
    receipt: {
      customer: { email: p.email },
      items: [{
        description: `AI фотосессия — ${p.photosCount} фото`,
        quantity: '1.00',
        amount: { value: p.price.toFixed(2), currency: 'RUB' },
        vat_code: 1,
        payment_subject: 'service',
        payment_mode: 'full_payment',
      }],
    },
    metadata: {
      order_id: p.orderId,
      tariff_id: p.tariffId,
      photos_count: String(p.photosCount),
      customer_key: p.customerKey ?? '',
    },
  };

  const idempotenceKey = crypto.randomUUID();

  const res = await fetch(`${BASE}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader(),
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as YooPayment & YooErrorBody;
  if (!res.ok) {
    const err = data as YooErrorBody;
    console.error('[yookassa] create payment failed', {
      status: res.status,
      type: err.type,
      code: err.code,
      description: err.description,
      parameter: err.parameter,
      idempotenceKey,
    });
    const detail = err.description || `${res.status}`;
    const e = new Error(`YooKassa ${err.code || res.status}: ${detail}`);
    (e as any).yooCode = err.code;
    (e as any).yooStatus = res.status;
    throw e;
  }

  return data as YooPayment;
}

// Безопасная диагностика кредов ЮKassa.
// НЕ возвращает сам секрет. Делает реальный GET на ЮKassa чтобы вернуть фактический ответ.
export async function diagnoseCredentials(): Promise<Record<string, unknown>> {
  const rawShop = process.env.YOOKASSA_SHOP_ID || '';
  const rawSecret = process.env.YOOKASSA_SECRET_KEY || '';
  const shop = rawShop.trim();
  const secret = rawSecret.trim();

  const out: Record<string, unknown> = {
    shopId_present: rawShop.length > 0,
    shopId_value: shop,
    shopId_only_digits: /^\d+$/.test(shop),
    shopId_has_whitespace: rawShop !== shop || /\s/.test(rawShop),

    secret_present: rawSecret.length > 0,
    secret_length: secret.length,
    secret_starts_with_live: secret.startsWith('live_'),
    secret_starts_with_test: secret.startsWith('test_'),
    secret_has_inner_whitespace: /\s/.test(secret),
    secret_has_trim_whitespace: rawSecret !== secret,
    secret_preview: secret.length > 8
      ? `${secret.slice(0, 5)}...${secret.slice(-4)}`
      : '<too short>',

    appUrl: process.env.APP_URL ?? null,
    allowedOrigins: process.env.ALLOWED_ORIGINS ?? null,
  };

  if (!shop || !secret) {
    out.yookassa_test = { ok: false, reason: 'shopId or secret not set' };
    return out;
  }

  // Делаем безобидный GET на /me — он возвращает данные шопа при валидных кредах.
  try {
    const auth = 'Basic ' + Buffer.from(`${shop}:${secret}`, 'utf-8').toString('base64');
    const r = await fetch(`${BASE}/me`, { headers: { 'Authorization': auth } });
    const body = await r.json().catch(() => ({}));
    out.yookassa_test = {
      ok: r.ok,
      status: r.status,
      response: r.ok
        ? { account_id: (body as any)?.account_id, test: (body as any)?.test }
        : { type: (body as any)?.type, code: (body as any)?.code, description: (body as any)?.description },
    };
  } catch (e: any) {
    out.yookassa_test = { ok: false, reason: 'network', message: e?.message };
  }
  return out;
}

export async function getPayment(paymentId: string): Promise<YooPayment | null> {
  const res = await fetch(`${BASE}/payments/${paymentId}`, {
    headers: { 'Authorization': authHeader() },
  });
  if (res.status === 404) return null;
  const data = (await res.json()) as YooPayment & YooErrorBody;
  if (!res.ok) {
    console.error('[yookassa] getPayment failed', { status: res.status, ...(data as YooErrorBody) });
    return null;
  }
  return data as YooPayment;
}

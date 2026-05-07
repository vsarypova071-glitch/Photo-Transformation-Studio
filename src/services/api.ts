// Единая точка для запросов к Beget backend.
// Заменяет вызовы supabase.functions.invoke / прямые fetch на supabase URL.
//
// Конфиг: VITE_API_URL (например, https://ai-fotosessia.ru или http://localhost:3000)
// Если /api проксируется тем же доменом, что фронт, можно оставить пустым — будут
// относительные URL ('/api/...').

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

function url(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    // ответ может быть не JSON (например, "OK" от webhook). Игнорим.
  }
  if (!resp.ok) {
    const err = new Error(data?.error || `HTTP ${resp.status}`);
    (err as any).status = resp.status;
    (err as any).body = data;
    throw err;
  }
  return data as T;
}

// === Payment ===

export interface CreatePaymentInput {
  tariffId: 'basic' | 'standard' | 'premium';
  userSessionId: string;
  customerKey: string;
  customerEmail: string;
  styleIds: string[];
  originalImageUrl: string | null;
  customPrompt?: string;
  isFullBody: boolean;
}

export interface CreatePaymentResult {
  orderId: string;
  paymentId?: string;
  paymentUrl?: string;
  reused?: boolean;
  existingOrder?: boolean;
  generationStatus?: string;
  paymentStatus?: string;
  photosCount?: number;
  results?: string[];
  message?: string;
}

export function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  return request<CreatePaymentResult>('/api/payment/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// === Order ===

export interface OrderStatus {
  orderId: string;
  paymentStatus: 'pending' | 'succeeded' | 'canceled' | 'expired' | 'refunded';
  generationStatus: 'waiting' | 'running' | 'done' | 'error' | 'canceled' | 'credits_credited';
  results: string[];
  photosCount: number;
  price: number;
  paymentMethod: 'rub' | 'credits';
  originalImage: string | null;
  styleIds: string[];
  customerKey: string | null;
  creditsPurchased: number;
}

export function checkOrder(orderId: string): Promise<OrderStatus> {
  return request<OrderStatus>(`/api/order/check?order_id=${encodeURIComponent(orderId)}`);
}

export interface RecentOrderResult {
  found: boolean;
  orderId?: string;
  paymentStatus?: string;
  generationStatus?: string;
  results?: string[];
  photosCount?: number;
  tariffId?: string;
  price?: number;
  paymentMethod?: 'rub' | 'credits';
  createdAt?: string;
}

export function findRecentOrder(customerKey: string): Promise<RecentOrderResult> {
  return request<RecentOrderResult>(`/api/order/find-recent?customer_key=${encodeURIComponent(customerKey)}`);
}

// === Balance ===

export interface BalanceResult {
  balance: number;
}

export function getBalance(customerKey: string): Promise<BalanceResult> {
  return request<BalanceResult>(`/api/balance?customer_key=${encodeURIComponent(customerKey)}`);
}

// === Photos (temp storage on VPS, TTL 30 min) ===

export interface UploadPhotoResult {
  filename: string;
  url: string;        // относительный, использовать вместе с VITE_API_URL/origin
  sizeBytes: number;
  ttlMinutes: number;
}

export async function uploadPhoto(blob: Blob): Promise<UploadPhotoResult> {
  const fd = new FormData();
  // имя нужно multer'у только для extension hint; реальный файл сгенерирует UUID
  const ext = blob.type === 'image/png' ? '.png'
            : blob.type === 'image/webp' ? '.webp'
            : '.jpg';
  fd.append('photo', blob, `photo${ext}`);

  const resp = await fetch(`${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api/photos/upload`, {
    method: 'POST',
    body: fd,
  });
  let data: any = null;
  try { data = await resp.json(); } catch {}
  if (!resp.ok) {
    const err = new Error(data?.error || `HTTP ${resp.status}`);
    (err as any).status = resp.status;
    (err as any).body = data;
    throw err;
  }
  return data as UploadPhotoResult;
}

// === Generation: Studio single ===

export interface GenerateSingleInput {
  customerKey: string;
  styleId?: string;
  stylePrompt?: string;
  sourcePhotoFilename: string;
  customPrompt?: string;
  isFullBody?: boolean;
  originalDimensions?: { width: number; height: number };
}

export interface GenerateSingleResult {
  generationId: string;
  imageUrl: string;       // относительный, /api/photos/<filename>
  ttlMinutes: number;
  balance: number;
  modelUsed?: string;
}

export function generateSingle(input: GenerateSingleInput): Promise<GenerateSingleResult> {
  return request<GenerateSingleResult>('/api/generation/single', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

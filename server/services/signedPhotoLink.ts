// Временные подписанные ссылки на файлы в PHOTO_TEMP_DIR — заменяют base64
// в теле запроса к AI Gateway/OpenRouter. Токен несёт имя файла и срок действия,
// подписан HMAC — без серверного состояния (переживает рестарт/несколько воркеров).
// НИКОГДА не логировать token/URL, только имя файла (оно и так не секрет —
// возвращается клиенту при аплоаде и уже видно в /api/photos/:filename).

import crypto from 'node:crypto';

const SEPARATOR = '|';
export const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 минут

function getSecret(): string {
  const secret = process.env.PHOTO_LINK_SIGNING_SECRET;
  if (!secret) {
    throw new Error('PHOTO_LINK_SIGNING_SECRET is not configured');
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export interface SignedLink {
  token: string;
  expiresAt: number;
}

/** filename должен быть уже нормализован (path.basename) вызывающим кодом. */
export function createSignedLink(filename: string, ttlMs: number = DEFAULT_TTL_MS): SignedLink {
  const expiresAt = Date.now() + ttlMs;
  const payload = Buffer.from(`${filename}${SEPARATOR}${expiresAt}`, 'utf8').toString('base64url');
  const sig = sign(payload, getSecret());
  return { token: `${payload}.${sig}`, expiresAt };
}

export type VerifyResult =
  | { ok: true; filename: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' }
  | { ok: false; reason: 'expired' };

export function verifySignedToken(token: string): VerifyResult {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2000) {
    return { ok: false, reason: 'malformed' };
  }

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === token.length - 1) {
    return { ok: false, reason: 'malformed' };
  }

  const payload = token.slice(0, dotIndex);
  const presentedSig = token.slice(dotIndex + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(payload, getSecret());
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const a = Buffer.from(presentedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let decoded: string;
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const sepIndex = decoded.lastIndexOf(SEPARATOR);
  if (sepIndex <= 0) return { ok: false, reason: 'malformed' };

  const filename = decoded.slice(0, sepIndex);
  const expiresAt = Number(decoded.slice(sepIndex + 1));
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' };

  if (Date.now() > expiresAt) return { ok: false, reason: 'expired' };

  return { ok: true, filename };
}

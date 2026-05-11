// Frontend-сервис реферальной системы.
//
// Flow:
//   1) При загрузке App.tsx — readReferralFromUrl() и сохранение в localStorage.
//   2) Сразу после — trackOnLanding(customerKey) шлёт POST /api/referrals/track.
//   3) При оплате — getStoredReferralCode() передаётся в createPayment().
//   4) Раздел «Пригласи друга» — useReferralInfo() / fetchMyReferral().

import { createLogger } from '@/utils/logger';

const log = createLogger('ReferralsService');
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const STORAGE_KEY = 'referral_code';
const TRACKED_KEY = 'referral_code_tracked';
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/i;

export function isValidReferralCode(s: unknown): s is string {
  return typeof s === 'string' && CODE_RE.test(s);
}

/** Парсит ?ref=XYZ123 из URL и сохраняет в localStorage. Возвращает код или null. */
export function readReferralFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref');
    if (!raw) return null;
    const code = raw.trim().toUpperCase();
    if (!isValidReferralCode(code)) return null;
    // Не перезаписываем существующий — первый победил
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_KEY, code);
      log.info('Referral code saved from URL', { code });
    }
    // Не чистим query string — это работа App.tsx если нужно
    return code;
  } catch {
    return null;
  }
}

export function getStoredReferralCode(): string | null {
  const code = (localStorage.getItem(STORAGE_KEY) || '').toUpperCase();
  return isValidReferralCode(code) ? code : null;
}

/** POST /api/referrals/track — один раз на лендинг. */
export async function trackOnLanding(customerKey: string): Promise<void> {
  const code = getStoredReferralCode();
  if (!code) return;
  if (localStorage.getItem(TRACKED_KEY) === code) return;
  try {
    const r = await fetch(`${API_BASE}/api/referrals/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: code, refereeKey: customerKey }),
    });
    if (r.status === 404) {
      // Фича выключена на бэке — нормально, тихо
      return;
    }
    const data = await r.json().catch(() => null);
    log.info('Track result', data);
    // Помечаем как трекнутый чтобы не спамить
    localStorage.setItem(TRACKED_KEY, code);
  } catch (e) {
    log.warn('track failed', e);
  }
}

// =============================================================================
// GET /api/referrals/me
// =============================================================================
export interface MyReferral {
  referralCode: string;
  referralLink: string;
  grantedCount: number;
  bonusCreditsTotal: number;
}

export async function fetchMyReferral(customerKey: string): Promise<MyReferral | null> {
  try {
    const r = await fetch(`${API_BASE}/api/referrals/me?customer_key=${encodeURIComponent(customerKey)}`);
    if (r.status === 404) return null; // фича выключена
    if (!r.ok) return null;
    return (await r.json()) as MyReferral;
  } catch (e) {
    log.warn('fetchMyReferral failed', e);
    return null;
  }
}

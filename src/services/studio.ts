// Studio: одиночная генерация на Beget VPS.
// Phase 2 — Studio first: refine/full-body пока на Supabase (см. backend.ts).
// Фото и результат хранятся 30 минут на VPS, потом cron их удаляет.

import { createLogger } from '@/utils/logger';
import {
  getBalance as apiGetBalance,
  uploadPhoto as apiUploadPhoto,
  generateSingle as apiGenerateSingle,
  generatePair as apiGeneratePair,
} from '@/services/api';

const log = createLogger('StudioService');

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

function absolutize(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return `${API_BASE}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`;
}

export interface BalanceInfo {
  accountId: string | null;
  balance: number;
  exists: boolean;
}

export interface UploadResult {
  /** Полный URL для рендера в <img src=...> и для скачивания */
  url: string;
  /** Имя файла на VPS — передавать в generateOne как sourcePhotoFilename */
  filename: string;
  dimensions?: { width: number; height: number };
  ttlMinutes: number;
}

export interface GenerateOneResult {
  generationId: string;
  /** Полный URL результата (живёт 30 минут) */
  imageUrl: string;
  /** Сколько времени файл доступен (минут) */
  ttlMinutes: number;
  /** Обновлённый баланс */
  balance: number;
}

export interface GenerateOneError {
  error: string;
  status: number;
  code?: string;
  refunded?: boolean;
  refundedAmount?: number;
  balance?: number;
}

class StudioService {
  /** Баланс кошелька. */
  async getBalance(customerKey: string): Promise<BalanceInfo> {
    const key = customerKey.trim();
    log.info('Fetching balance', { customerKey: key });
    try {
      const data = await apiGetBalance(key);
      const balance = typeof data.balance === 'number' ? data.balance : 0;
      return { accountId: null, balance, exists: balance > 0 };
    } catch (e) {
      log.error('getBalance failed', e);
      return { accountId: null, balance: 0, exists: false };
    }
  }

  /**
   * Загрузить фото юзера во временное хранилище VPS.
   * TTL 30 минут — после этого фото и все результаты удаляются cron-ом.
   */
  async uploadPhoto(base64DataUrl: string): Promise<UploadResult> {
    log.info('Uploading photo to Beget /api/photos/upload');

    // dimensions для aspect ratio
    const dimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(undefined);
      img.src = base64DataUrl;
    });

    // base64 → Blob
    const m = base64DataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    const mime = m?.[1] ?? 'image/jpeg';
    const b64 = m?.[2] ?? base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });

    const result = await apiUploadPhoto(blob);
    log.info('Photo uploaded', { filename: result.filename, size: result.sizeBytes });

    return {
      url: absolutize(result.url),
      filename: result.filename,
      dimensions,
      ttlMinutes: result.ttlMinutes,
    };
  }

  /**
   * Сгенерить одно фото за 1 кредит. Если AI упадёт — кредит вернётся
   * (бэкенд сам делает refund). Бросает GenerateOneError.
   */
  async generateOne(params: {
    customerKey: string;
    styleId: string;
    sourcePhotoFilename: string;
    customPrompt?: string;
    isFullBody?: boolean;
    genderMode?: 'female' | 'male';
    originalDimensions?: { width: number; height: number };
  }): Promise<GenerateOneResult> {
    log.info('generateOne start', { styleId: params.styleId, genderMode: params.genderMode });

    try {
      const data = await apiGenerateSingle({
        customerKey: params.customerKey,
        styleId: params.styleId,
        sourcePhotoFilename: params.sourcePhotoFilename,
        customPrompt: params.customPrompt,
        isFullBody: params.isFullBody,
        genderMode: params.genderMode,
        originalDimensions: params.originalDimensions,
      });
      return {
        generationId: data.generationId,
        imageUrl: absolutize(data.imageUrl),
        ttlMinutes: data.ttlMinutes,
        balance: data.balance,
      };
    } catch (e: any) {
      const status = e?.status ?? 500;
      const body = e?.body ?? {};
      const err: GenerateOneError = {
        error: body.error || e?.message || 'Ошибка генерации',
        status,
        code: body.code,
        refunded: !!body.refunded,
        balance: typeof body.balance === 'number' ? body.balance : undefined,
      };
      log.error('generateOne failed', err);
      throw err;
    }
  }

  /**
   * Сгенерить одно парное фото за 2 кредита (Phase 5 — Together styles).
   * Если AI упадёт — оба кредита вернутся (бэкенд делает refund).
   * Бросает GenerateOneError.
   */
  async generatePair(params: {
    customerKey: string;
    styleId: string;
    sourcePhotoFilenameA: string;
    sourcePhotoFilenameB: string;
  }): Promise<GenerateOneResult> {
    log.info('generatePair start', { styleId: params.styleId });

    try {
      const data = await apiGeneratePair({
        customerKey: params.customerKey,
        styleId: params.styleId,
        sourcePhotoFilenameA: params.sourcePhotoFilenameA,
        sourcePhotoFilenameB: params.sourcePhotoFilenameB,
      });
      return {
        generationId: data.generationId,
        imageUrl: absolutize(data.imageUrl),
        ttlMinutes: data.ttlMinutes,
        balance: data.balance,
      };
    } catch (e: any) {
      const status = e?.status ?? 500;
      const body = e?.body ?? {};
      const err: GenerateOneError = {
        error: body.error || e?.message || 'Ошибка парной генерации',
        status,
        code: body.code,
        refunded: !!body.refunded,
        refundedAmount: typeof body.refundedAmount === 'number' ? body.refundedAmount : undefined,
        balance: typeof body.balance === 'number' ? body.balance : undefined,
      };
      log.error('generatePair failed', err);
      throw err;
    }
  }
}

export const studio = new StudioService();

// 🟢 STAGE WALLET 1.4 — клиентский сервис для модели «кошелёк»
// - Получает баланс из credit_accounts по customer_key
// - Загружает фото в storage user-photos (как handlePayWithCredits)
// - Дёргает edge функцию generate-one (по 1 фото = -1 кредит)
// - НЕ сохраняет результат: возвращает base64 для скачивания юзером
//
// 152-ФЗ: фото нигде не оседают — только в ответе функции и в памяти браузера.

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';
import { getBalance as apiGetBalance } from '@/services/api';

const log = createLogger('StudioService');

export interface BalanceInfo {
  accountId: string | null;
  balance: number;
  exists: boolean;
}

export interface GenerateOneResult {
  generationId: string;
  imageUrl: string;       // data:image/...;base64,... — отдать юзеру и забыть
  balance: number;        // обновлённый баланс
}

export interface GenerateOneError {
  error: string;
  status: number;
  refunded?: boolean;
  balance?: number;
}

class StudioService {
  /**
   * Получить актуальный баланс кошелька по customer_key.
   * Если аккаунта нет — вернёт { exists: false, balance: 0 }.
   */
  async getBalance(customerKey: string): Promise<BalanceInfo> {
    const key = customerKey.trim();
    log.info('Fetching balance', { customerKey: key });
    try {
      const data = await apiGetBalance(key);
      const balance = typeof data.balance === 'number' ? data.balance : 0;
      // accountId/exists больше не возвращаем — фронт ими не пользуется.
      // Сохраняем форму ответа для совместимости.
      return { accountId: null, balance, exists: balance > 0 };
    } catch (e) {
      log.error('getBalance failed', e);
      return { accountId: null, balance: 0, exists: false };
    }
  }

  /**
   * Загрузить фото юзера в storage user-photos.
   * Возвращает публичный URL (бакет публичный).
   */
  async uploadPhoto(base64DataUrl: string, sessionId: string): Promise<{ url: string; dimensions?: { width: number; height: number } }> {
    log.info('Uploading photo to storage');

    // Размеры (для aspect ratio в генерации)
    const dimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(undefined);
      img.src = base64DataUrl;
    });

    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'image/jpeg' });

    const fileName = `${sessionId}/studio_${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('user-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      log.error('Upload failed', error);
      throw new Error('Не удалось загрузить фото: ' + error.message);
    }

    const { data } = supabase.storage.from('user-photos').getPublicUrl(fileName);
    log.info('Photo uploaded', { url: data.publicUrl });
    return { url: data.publicUrl, dimensions };
  }

  /**
   * Сгенерить ОДНО фото за 1 кредит.
   * Бросает GenerateOneError при провале (с пометкой refunded если кредит вернулся).
   */
  async generateOne(params: {
    customerKey: string;
    styleId: string;
    stylePrompt: string;
    originalImageUrl: string;
    customPrompt?: string;
    isFullBody?: boolean;
    originalDimensions?: { width: number; height: number };
  }): Promise<GenerateOneResult> {
    log.info('generateOne start', { styleId: params.styleId });

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-one`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          customer_key: params.customerKey,
          style_id: params.styleId,
          style_prompt: params.stylePrompt,
          original_image_url: params.originalImageUrl,
          custom_prompt: params.customPrompt,
          is_full_body: params.isFullBody,
          original_dimensions: params.originalDimensions,
        }),
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      log.error('generateOne failed', { status: resp.status, data });
      const err: GenerateOneError = {
        error: data?.error || 'Ошибка генерации',
        status: resp.status,
        refunded: !!data?.refunded,
        balance: typeof data?.balance === 'number' ? data.balance : undefined,
      };
      throw err;
    }

    return {
      generationId: data.generation_id,
      imageUrl: data.image_url,
      balance: data.balance ?? 0,
    };
  }
}

export const studio = new StudioService();

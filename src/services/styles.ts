// Получает каталог стилей с Beget /api/styles, при сбое — fallback
// на bundle-ный src/lib/constants.ts (то, что было всегда).
//
// Стратегия:
//   1) Кэшируем результат в localStorage на 1 час (stale-while-revalidate).
//   2) В UI рендерим что есть в кэше, фоном обновляем.
//   3) Если /api/styles вернул [] (миграция не применена) — берём bundle.
//
// API-стиль:                           Bundle-стиль (текущий type Style):
//   id, title, description,              id, name, category,
//   previewUrl (может быть NULL),        description, prompt,
//   category, legacyCategory,            previewUrl (всегда есть)
//   prompt, clubOnly, sortOrder
//
// Для обратной совместимости адаптируем API → bundle-формат.

import type { Style, StyleCategory } from '@/types';
import { STYLES as BUNDLED_STYLES } from '@/lib/constants';
import { createLogger } from '@/utils/logger';

const log = createLogger('StylesService');
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const CACHE_KEY = 'poto.styles.cache.v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

interface ApiStyle {
  id: string;
  title: string;
  description: string | null;
  previewUrl: string | null;
  category: string | null;
  legacyCategory: string | null;
  prompt: string;
  clubOnly: boolean;
  sortOrder: number;
}

interface ApiResponse {
  items: ApiStyle[];
  count: number;
  fallback?: boolean;
}

interface Cache {
  ts: number;
  styles: Style[];
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (!parsed?.ts || !Array.isArray(parsed.styles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(styles: Style[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), styles } satisfies Cache));
  } catch {
    /* quota / private mode — ignore */
  }
}

function bundlePreview(id: string): string {
  const fromBundle = BUNDLED_STYLES.find((s) => s.id === id);
  return fromBundle?.previewUrl ?? '';
}

function adapt(api: ApiStyle): Style {
  // category: новые маркетинговые из БД пусто → используем legacy (realistic/wild),
  // если и его нет — приземляемся на 'realistic' как самый широкий.
  const cat: StyleCategory =
    (api.category as StyleCategory | null) ??
    (api.legacyCategory as StyleCategory | null) ??
    'realistic';

  return {
    id: api.id,
    name: api.title,
    category: cat,
    description: api.description ?? '',
    prompt: api.prompt,
    // Если в БД нет preview — берём из bundle (по id). Так старые ассеты
    // продолжают работать без миграции картинок в БД/CDN.
    previewUrl: api.previewUrl || bundlePreview(api.id),
  };
}

/**
 * Возвращает стили (всегда что-то возвращает — не бросает).
 * Используется как: const styles = await fetchStyles();
 */
export async function fetchStyles(opts?: { includeClub?: boolean }): Promise<Style[]> {
  const includeClub = opts?.includeClub ?? false;

  try {
    const url = `${API_BASE}/api/styles${includeClub ? '?include_club=true' : ''}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as ApiResponse;

    if (data.fallback || data.count === 0) {
      log.info('API returned empty / fallback — using bundle');
      return BUNDLED_STYLES;
    }
    const adapted = data.items.map(adapt);
    writeCache(adapted);
    return adapted;
  } catch (e: any) {
    log.warn('fetch /api/styles failed, using cache or bundle', e?.message);
    const cached = readCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.styles;
    }
    return BUNDLED_STYLES;
  }
}

/** Синхронная версия: отдаёт что есть прямо сейчас (cache → bundle). */
export function getStylesSync(): Style[] {
  const cached = readCache();
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.styles;
  return BUNDLED_STYLES;
}

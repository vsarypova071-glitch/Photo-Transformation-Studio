// Универсальное скачивание сгенерированного фото с разной логикой для
// desktop / Android / iPhone. Сервер должен отдавать Content-Disposition: attachment
// на /api/photos/download/:filename — это endpoint и есть в Beget API.

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export type DeviceKind = 'desktop' | 'android' | 'ios' | 'other-mobile';

export function detectDevice(): DeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPad на iOS 13+ называет себя 'MacIntel' с touch — учитываем
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  // прочие mobile (Windows Phone, KaiOS) — на всякий
  if (/Mobi|Tablet/i.test(ua)) return 'other-mobile';
  return 'desktop';
}

export interface DownloadResult {
  /** Какая ветка реально сработала — для UX-фидбека */
  via: 'web-share' | 'anchor-download' | 'navigation' | 'open-window';
  device: DeviceKind;
}

/**
 * Универсальное скачивание / шеринг фото.
 *
 * Стратегия:
 * - desktop / android: <a href="/api/photos/download/<file>" download>...</a> — нативный download.
 * - iOS: пытаемся navigator.share с File (откроет «Сохранить в фото»). Fallback —
 *   навигация на download endpoint (Safari покажет «Загрузить» в нижнем меню).
 *
 * @param imageUrl — полный URL фото (как мы его уже показываем в <img>).
 *                  Из него берём filename и зовём /api/photos/download/<filename>.
 */
export async function downloadGeneratedPhoto(imageUrl: string): Promise<DownloadResult> {
  const device = detectDevice();
  const filename = imageUrl.split('?')[0].split('/').pop() || 'photo.jpg';
  const downloadUrl = `${API_BASE}/api/photos/download/${encodeURIComponent(filename)}`;

  // === iOS: Web Share API с File ===
  if (device === 'ios' && typeof navigator !== 'undefined' && (navigator as any).canShare) {
    try {
      const resp = await fetch(downloadUrl, { credentials: 'omit', cache: 'no-store' });
      if (resp.ok) {
        const blob = await resp.blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        // Имя для UI Share Sheet
        const shareName = downloadFilenameStamp(ext);
        const file = new File([blob], shareName, { type: blob.type || 'image/jpeg' });
        const shareData: any = { files: [file], title: 'AI Фотосессия' };
        if ((navigator as any).canShare(shareData)) {
          await (navigator as any).share(shareData);
          return { via: 'web-share', device };
        }
      }
    } catch (e) {
      // Юзер отменил Share Sheet — это AbortError. В этом случае не падаем
      // в fallback, пусть юзер просто закрыл диалог.
      if ((e as any)?.name === 'AbortError') {
        return { via: 'web-share', device };
      }
      // Прочие ошибки — пойдём в fallback ниже.
    }
  }

  // === Desktop / Android: anchor с атрибутом download ===
  // Для same-origin запросов браузер уважает download и Content-Disposition.
  // Beget API на том же домене → проблем с download-блокировкой нет.
  try {
    const a = document.createElement('a');
    a.href = downloadUrl;
    // Просим браузер сохранить с этим именем (на случай если CDN уберёт CD;
    // у нас CDN нет, но safety net).
    a.download = '';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { via: 'anchor-download', device };
  } catch {
    // последний fallback — открыть в новой вкладке: Safari покажет share-share меню.
    window.open(downloadUrl, '_blank', 'noopener');
    return { via: 'open-window', device };
  }
}

function downloadFilenameStamp(ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `ai-fotosessia-result-${stamp}.${ext}`;
}

import { useState, useEffect, useRef } from 'react';
import { Job } from '../../types';

const BONUS_KEY = 'ai_studio_share_bonus';

interface ResultsScreenProps {
  job: Job;
  onRefine: (prompt: string) => void;
  onFullBody: () => void;
  onNewPhoto: () => void;
  onBackToStyles: () => void;
}

const SHARE_TEXT = `Создал свою AI фотосессию ✨\n\n#AIphoto #AIportrait #AIStudio`;

async function addWatermark(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(14, Math.min(18, img.naturalWidth * 0.025));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText('AI Photo Studio', img.naturalWidth - 20, img.naturalHeight - 20);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

async function getBlobFromImageSource(src: string): Promise<Blob> {
  const res = await fetch(src, { mode: 'cors', cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Не удалось получить изображение: ${res.status}`);
  }
  return await res.blob();
}

// STAGE 2.1: iOS Safari ignores <a download>. We must use blob URL + new tab + hint.
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document);
}

function forceDownloadBlob(blob: Blob, filename: string): { iosHint: boolean } {
  const blobUrl = URL.createObjectURL(blob);

  if (isIOS()) {
    // На iOS <a download> не работает — открываем в новой вкладке,
    // пользователь долгим тапом сохраняет в Фото.
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return { iosHint: true };
  }

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return { iosHint: false };
}

export default function ResultsScreen({
  job,
  onRefine,
  onFullBody,
  onNewPhoto,
  onBackToStyles,
}: ResultsScreenProps) {
  const [showMagick, setShowMagick] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<string | null>(null);
  const [showBonusToast, setShowBonusToast] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [bonusCredits, setBonusCredits] = useState(() => {
    const saved = sessionStorage.getItem(BONUS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const popupShownRef = useRef(false);

  const allResults = (job.results || []).filter(Boolean);
  const resultImage = allResults[activeIndex] || allResults[0] || '';

  useEffect(() => {
    if (resultImage && !popupShownRef.current) {
      popupShownRef.current = true;
      const t = setTimeout(() => setShowSharePopup(true), 1200);
      return () => clearTimeout(t);
    }
  }, [resultImage]);

  const handleDownload = async (withWatermark = false) => {
    if (!resultImage || isDownloading) return;

    setIsDownloading(true);

    try {
      const fileName = withWatermark
        ? `ai-photo-${Date.now()}-watermarked.png`
        : `ai-photo-${Date.now()}.jpg`;

      let blob: Blob;

      if (withWatermark) {
        const watermarkedDataUrl = await addWatermark(resultImage);
        const res = await fetch(watermarkedDataUrl);
        blob = await res.blob();
      } else {
        try {
          blob = await getBlobFromImageSource(resultImage);
        } catch (corsErr) {
          // STAGE 2.1: CORS-fallback — если fetch упал (например, CORS),
          // открываем картинку в новой вкладке. Пользователь сохранит вручную.
          console.warn('CORS fetch failed, fallback to direct open', corsErr);
          window.open(resultImage, '_blank');
          if (isIOS()) {
            setIosHint(true);
            setTimeout(() => setIosHint(false), 6000);
          }
          setIsDownloading(false);
          return;
        }
      }

      // На телефоне сначала пробуем нативное меню "Поделиться / Сохранить"
      if (navigator.share) {
        try {
          const file = new File([blob], fileName, {
            type: blob.type || (withWatermark ? 'image/png' : 'image/jpeg'),
          });

          const shareData: ShareData = {
            files: [file],
            title: 'AI Photo Studio',
            text: 'Сохранить фото',
          };

          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share(shareData);
            setIsDownloading(false);
            return;
          }
        } catch (err) {
          console.log('Share fallback to direct download', err);
        }
      }

      // Обычное скачивание файла с нормальным именем
      const result = forceDownloadBlob(blob, fileName);
      if (result.iosHint) {
        setIosHint(true);
        setTimeout(() => setIosHint(false), 6000);
      }
    } catch (err) {
      console.error('Download failed', err);
      alert('Не удалось сохранить изображение. Попробуйте ещё раз.');
    } finally {
      setIsDownloading(false);
    }
  };

  const grantShareBonus = () => {
    const newBonus = bonusCredits + 1;
    setBonusCredits(newBonus);
    sessionStorage.setItem(BONUS_KEY, String(newBonus));
    setShowBonusToast(true);
    setTimeout(() => setShowBonusToast(false), 3500);
  };

  const handleShare = async (platform: 'instagram' | 'telegram' | 'twitter') => {
    if (!resultImage) return;

    setSharingPlatform(platform);
    setShowSharePopup(false);

    try {
      const watermarked = await addWatermark(resultImage);
      let shared = false;

      if (navigator.share) {
        const file = await dataUrlToFile(
          watermarked,
          `ai-photo-studio-${Date.now()}.png`
        );

        const shareData: ShareData = {
          files: [file],
          text: SHARE_TEXT,
        };

        if (platform === 'twitter') {
          const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            SHARE_TEXT
          )}`;
          window.open(tweetUrl, '_blank');
          shared = true;
        } else {
          await navigator.share(shareData);
          shared = true;
        }
      } else {
        if (platform === 'twitter') {
          const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            SHARE_TEXT
          )}`;
          window.open(tweetUrl, '_blank');
          shared = true;
        } else if (platform === 'telegram') {
          const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
            'https://photo-transformation-studio.lovable.app'
          )}&text=${encodeURIComponent(SHARE_TEXT)}`;
          window.open(tgUrl, '_blank');
          await handleDownload(true);
          shared = true;
        } else {
          await handleDownload(true);
          shared = true;
        }
      }

      if (shared) {
        grantShareBonus();
      }
    } catch (err) {
      console.log('Share cancelled or failed', err);
    } finally {
      setSharingPlatform(null);
    }
  };

  return (
    <>
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${
          showBonusToast
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-2xl font-black text-sm whitespace-nowrap">
          <span className="text-xl">🎁</span>
          <div>
            <p className="text-xs opacity-80 uppercase tracking-widest leading-none mb-0.5">
              Бонус получен!
            </p>
            <p>+1 бесплатная генерация</p>
          </div>
        </div>
      </div>

      {/* STAGE 2.1: iOS save-to-Photos hint */}
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${
          iosHint
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-2xl shadow-2xl font-semibold text-xs max-w-[90vw]">
          <span className="text-lg">📲</span>
          <div className="leading-tight">
            <p className="font-black mb-0.5">Сохраните фото</p>
            <p className="opacity-80">Удерживайте картинку → «Сохранить в Фото»</p>
          </div>
        </div>
      </div>

      {showSharePopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-10 px-6">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setShowSharePopup(false)}
          />
          <div className="relative w-full max-w-md glass rounded-[2rem] p-8 border border-primary/20 animate-in slide-in-from-bottom duration-400 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-3xl mb-3">✨</div>
              <h3 className="text-lg font-black text-foreground mb-1">
                Ваше фото готово!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Поделитесь результатом и получите
                <br />
                <span className="text-primary font-black">
                  +1 бесплатное фото
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSharePopup(false)}
                className="flex-1 bg-secondary py-4 rounded-2xl font-black text-[10px] uppercase text-muted-foreground"
              >
                Позже
              </button>
              <button
                onClick={() => {
                  setShowSharePopup(false);
                  handleShare('telegram');
                }}
                className="flex-[2] bg-primary text-primary-foreground py-4 rounded-2xl font-black text-xs uppercase shadow-2xl"
              >
                Поделиться
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="min-h-screen flex flex-col px-6 py-28 overflow-y-auto no-scrollbar pb-80">
        <h2 className="text-3xl font-black uppercase mb-4 text-foreground">
          Результат
        </h2>

        {allResults.length > 1 && (
          <div className="flex gap-2 mb-5">
            {allResults.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  activeIndex === i
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                Вариант {i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 mb-4 shadow-2xl group">
          <img
            key={activeIndex}
            src={resultImage}
            className="w-full bg-secondary min-h-[400px] object-cover animate-in fade-in duration-300"
            alt={`Вариант ${activeIndex + 1}`}
          />

          <button
            onClick={() => handleDownload(false)}
            disabled={isDownloading}
            className="absolute bottom-8 right-8 bg-primary text-primary-foreground p-5 rounded-full shadow-2xl active:scale-90 transition-all hover:scale-110 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isDownloading ? (
              <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        {allResults.length > 1 && (
          <div className="flex gap-2 mb-5">
            {allResults.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`flex-1 aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                  activeIndex === i
                    ? 'border-primary shadow-lg shadow-primary/30'
                    : 'border-transparent opacity-60'
                }`}
              >
                <img
                  src={img}
                  className="w-full h-full object-cover"
                  alt={`thumb ${i + 1}`}
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2.5 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3 mb-5">
          <span className="text-base mt-0.5">🤖</span>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground/70">
              Это художественная интерпретация AI.
            </span>{' '}
            Черты лица могут незначительно отличаться от оригинала — выберите
            лучший вариант из {allResults.length > 1 ? `${allResults.length} ` : ''}
            результата{allResults.length > 1 ? 'ов' : 'а'}.
          </p>
        </div>

        <div className="glass rounded-[2rem] p-6 border border-white/5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">
              Поделиться результатом
            </p>

            {bonusCredits > 0 && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                <span className="text-xs">🎁</span>
                <span className="text-[10px] font-black text-primary">
                  +{bonusCredits} бонус
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">
            Поделитесь результатом — получите{' '}
            <span className="text-primary font-black">
              +1 бесплатную генерацию
            </span>
          </p>

          <div className="flex items-center justify-around">
            <button
              onClick={() => handleShare('instagram')}
              disabled={sharingPlatform !== null}
              className="flex flex-col items-center gap-2 group disabled:opacity-50"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 group-hover:scale-110 shadow-lg"
                style={{
                  background:
                    'linear-gradient(135deg, #f58529, #dd2a7b, #8134af, #515bd4)',
                }}
              >
                {sharingPlatform === 'instagram' ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                Instagram
              </span>
            </button>

            <button
              onClick={() => handleShare('telegram')}
              disabled={sharingPlatform !== null}
              className="flex flex-col items-center gap-2 group disabled:opacity-50"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 group-hover:scale-110 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #2aabee, #229ed9)' }}
              >
                {sharingPlatform === 'telegram' ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                Telegram
              </span>
            </button>

            <button
              onClick={() => handleShare('twitter')}
              disabled={sharingPlatform !== null}
              className="flex flex-col items-center gap-2 group disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center transition-all active:scale-90 group-hover:scale-110 shadow-lg border border-white/10">
                {sharingPlatform === 'twitter' ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                Twitter
              </span>
            </button>
          </div>
        </div>

        {!showMagick && (
          <div className="flex flex-col gap-4">
            {!job.isFullBody && (
              <button
                onClick={onFullBody}
                className="w-full bg-primary/10 border border-primary/30 py-6 rounded-full flex items-center justify-center gap-4 transition-all active:scale-95 text-primary font-black text-xs uppercase"
              >
                <span>🕴️</span> Сделать во весь рост (1 кр.)
              </button>
            )}

            <button
              onClick={() => setShowMagick(true)}
              className="w-full bg-secondary border border-border py-6 rounded-full flex items-center justify-center gap-4 transition-all active:scale-95 font-black text-xs uppercase"
            >
              <span>🪄</span> Магическая правка (1 кр.)
            </button>
          </div>
        )}

        {showMagick && (
          <div className="glass p-8 rounded-[2rem] border-primary/20 mt-6 animate-in slide-in-from-top duration-300">
            <p className="text-[10px] font-black text-primary mb-3 uppercase tracking-widest">
              Магическая ретушь
            </p>

            <textarea
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="Например: Смени костюм на черный..."
              className="w-full bg-secondary/50 border border-border rounded-2xl p-6 text-sm mb-6 outline-none focus:border-primary text-foreground resize-none h-32"
            />

            <div className="flex gap-4">
              <button
                onClick={() => setShowMagick(false)}
                className="flex-1 bg-secondary py-5 rounded-full font-black text-[10px] uppercase"
              >
                Отмена
              </button>
              <button
                onClick={() => onRefine(refinePrompt)}
                className="flex-[2] bg-primary text-primary-foreground py-5 rounded-full font-black text-[10px] uppercase"
              >
                Применить
              </button>
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-8 glass border-t border-white/5 flex gap-4 z-50 max-w-md mx-auto">
          <button
            onClick={onBackToStyles}
            className="flex-1 bg-secondary py-5 rounded-2xl font-black text-xs uppercase"
          >
            Стили
          </button>
          <button
            onClick={onNewPhoto}
            className="flex-[2] bg-primary text-primary-foreground py-5 rounded-2xl font-black text-xs uppercase shadow-2xl"
          >
            Новое фото
          </button>
        </div>
      </section>
    </>
  );
}

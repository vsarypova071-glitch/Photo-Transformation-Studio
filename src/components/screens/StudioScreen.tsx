// 🟢 STAGE WALLET 1.4 — главный экран модели «кошелёк»
// Шаги: загрузка фото → согласие на биометрию (152-ФЗ) → выбор 1 стиля
// → кнопка «Сгенерировать (-1)» → показ фото с большой кнопкой «Скачать»
// + предупреждение «фото нигде не сохраняется».

import { useState } from 'react';
import { STYLES } from '@/lib/constants';
import { studio } from '@/services/studio';
import { createLogger } from '@/utils/logger';

const log = createLogger('StudioScreen');

interface StudioScreenProps {
  customerKey: string;
  initialBalance: number;
  onBalanceChange: (newBalance: number) => void;
  onBuyMore: () => void;
}

type Step = 'upload' | 'choose' | 'generating' | 'result';

export default function StudioScreen({
  customerKey,
  initialBalance,
  onBalanceChange,
  onBuyMore,
}: StudioScreenProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [step, setStep] = useState<Step>('upload');

  // upload
  const [uploadedImage, setUploadedImage] = useState<string>(''); // base64 (для превью)
  const [uploadedUrl, setUploadedUrl] = useState<string>('');     // URL в storage
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | undefined>();
  const [biometryConsent, setBiometryConsent] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // choose
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [isFullBody, setIsFullBody] = useState(false);

  // result
  const [resultImage, setResultImage] = useState<string>('');
  const [resultStyleName, setResultStyleName] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  // common
  const [error, setError] = useState<string | null>(null);

  const sessionId = (() => {
    let id = sessionStorage.getItem('anon_user_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2);
      sessionStorage.setItem('anon_user_id', id);
    }
    return id;
  })();

  // === Шаг 1: загрузка фото ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!biometryConsent) {
      setError('Отметьте согласие на обработку биометрических данных, чтобы продолжить.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadedImage(base64);

      const { url, dimensions } = await studio.uploadPhoto(base64, sessionId);
      setUploadedUrl(url);
      setOriginalDimensions(dimensions);
      setStep('choose');
    } catch (err: any) {
      log.error('Upload failed', err);
      setError(err.message || 'Не удалось загрузить фото');
      setUploadedImage('');
    } finally {
      setIsUploading(false);
    }
  };

  // === Шаг 2: выбор стиля и генерация ===
  const handleGenerate = async () => {
    if (!selectedStyleId) {
      setError('Выберите стиль');
      return;
    }
    if (balance < 1) {
      setError('Недостаточно кредитов');
      return;
    }

    const style = STYLES.find(s => s.id === selectedStyleId);
    if (!style) {
      setError('Стиль не найден');
      return;
    }

    setError(null);
    setStep('generating');

    try {
      const res = await studio.generateOne({
        customerKey,
        styleId: style.id,
        stylePrompt: style.prompt,
        originalImageUrl: uploadedUrl,
        isFullBody,
        originalDimensions,
      });

      setResultImage(res.imageUrl);
      setResultStyleName(style.name);
      setBalance(res.balance);
      onBalanceChange(res.balance);
      setStep('result');
    } catch (err: any) {
      log.error('Generation failed', err);
      const msg = err?.error || err?.message || 'Ошибка генерации';
      const refunded = err?.refunded;
      setError(refunded ? `${msg} Кредит возвращён на баланс.` : msg);
      // если кредит вернули — обновим баланс
      if (typeof err?.balance === 'number') {
        setBalance(err.balance);
        onBalanceChange(err.balance);
      } else {
        // подтянем актуальный баланс
        const info = await studio.getBalance(customerKey);
        setBalance(info.balance);
        onBalanceChange(info.balance);
      }
      setStep('choose');
    }
  };

  // === Скачивание фото с поддержкой iOS/Android ===
  const handleDownload = async () => {
    if (!resultImage || isDownloading) return;
    const fileName = `ai-photo-${Date.now()}.jpg`;
    setIsDownloading(true);
    setIosHint(false);
    try {
      const res = await fetch(resultImage, { mode: 'cors', cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const ua = navigator.userAgent || '';
      const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);

      if (ios) {
        // iOS Safari/WebView игнорирует <a download> — открываем в новой вкладке,
        // пользователь долгим тапом сохраняет в «Фото».
        const win = window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        setIosHint(true);
        setTimeout(() => setIosHint(false), 8000);
        if (!win) {
          // Попап заблокирован (in-app браузер) — открываем лайтбокс с подсказкой
          setLightboxOpen(true);
        }
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch {
      // CORS или сеть недоступны — открываем прямую ссылку
      const win = window.open(resultImage, '_blank', 'noopener');
      setIosHint(true);
      setTimeout(() => setIosHint(false), 8000);
      if (!win) {
        setLightboxOpen(true);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // === После результата — обратно к выбору стиля ===
  const handleNext = () => {
    setResultImage('');
    setResultStyleName('');
    setStep(balance > 0 ? 'choose' : 'upload');
  };

  // ─────────────────────── RENDER ───────────────────────
  return (
    <section className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Хедер с балансом */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Студия</p>
          <h1 className="text-2xl font-sans uppercase tracking-tighter">AI Фотосессия</h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Баланс</p>
          <p className="text-2xl font-bold text-primary">{balance} <span className="text-xs text-muted-foreground">фото</span></p>
        </div>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* === ШАГ 1: ЗАГРУЗКА === */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-sans uppercase tracking-tighter mb-2">Загрузите селфи</h2>
            <p className="text-sm text-muted-foreground font-serif">
              AI сохранит ваше лицо и создаст премиальный образ
            </p>
          </div>

          {/* Чекбокс согласия — 152-ФЗ */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-secondary/40 border border-border cursor-pointer hover:border-primary/40 transition-colors">
            <input
              type="checkbox"
              checked={biometryConsent}
              onChange={e => setBiometryConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-primary cursor-pointer flex-shrink-0"
            />
            <span className="text-xs text-foreground/80 leading-relaxed">
              Я даю согласие на обработку биометрических персональных данных (фото лица) для AI‑генерации в соответствии со ст. 11 152‑ФЗ.
              Сгенерированные фотографии <strong>не сохраняются на сервере</strong> — отдаются вам в браузер для скачивания.
            </span>
          </label>

          <div className={`relative aspect-square w-full max-w-sm mx-auto rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center overflow-hidden group transition-all ${biometryConsent ? 'border-border bg-secondary/40 hover:border-primary cursor-pointer' : 'border-border/40 bg-secondary/20 opacity-60 cursor-not-allowed'}`}>
            {!isUploading ? (
              <div className="flex flex-col items-center px-10 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-foreground mb-2 uppercase">Выбрать селфи</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {biometryConsent ? 'Лицо останется реальным' : 'Сначала отметьте согласие'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent animate-spin rounded-full mb-4" />
                <p className="text-xs font-bold text-muted-foreground uppercase">Загрузка...</p>
              </div>
            )}
            {biometryConsent && !isUploading && (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            )}
          </div>
        </div>
      )}

      {/* === ШАГ 2: ВЫБОР СТИЛЯ === */}
      {step === 'choose' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {uploadedImage && (
              <img src={uploadedImage} alt="Ваше фото" className="w-20 h-20 rounded-xl object-cover border border-border" />
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Ваше фото</p>
              <button
                onClick={() => { setUploadedImage(''); setUploadedUrl(''); setStep('upload'); }}
                className="text-xs text-primary hover:underline mt-1"
              >
                Заменить фото
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-sans uppercase tracking-tighter mb-3">Выберите стиль</h2>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all text-left ${
                    selectedStyleId === style.id
                      ? 'border-primary scale-[0.98] shadow-lg shadow-primary/20'
                      : 'border-border hover:border-primary/60'
                  }`}
                >
                  <img src={style.previewUrl} alt={style.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-bold uppercase tracking-tight leading-tight">{style.name}</p>
                    <p className="text-white/70 text-[10px] mt-0.5">{style.description}</p>
                  </div>
                  {selectedStyleId === style.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/40 border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={isFullBody}
              onChange={e => setIsFullBody(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span className="text-sm text-foreground">Во весь рост</span>
          </label>

          <button
            onClick={handleGenerate}
            disabled={!selectedStyleId || balance < 1}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
          >
            {balance < 1 ? 'Недостаточно кредитов' : `Сгенерировать (−1 фото)`}
          </button>

          {balance < 1 && (
            <button
              onClick={onBuyMore}
              className="w-full py-3 rounded-2xl border border-primary text-primary font-bold uppercase tracking-wider text-sm hover:bg-primary/10 transition-all"
            >
              Купить ещё фото
            </button>
          )}
        </div>
      )}

      {/* === ШАГ 3: ГЕНЕРАЦИЯ === */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 border-4 border-primary border-t-transparent animate-spin rounded-full mb-6" />
          <h2 className="text-xl font-sans uppercase tracking-tighter mb-2">Создаём ваше фото</h2>
          <p className="text-sm text-muted-foreground font-serif">Обычно 30–90 секунд</p>
        </div>
      )}

      {/* iOS hint — подсказка «удержите, чтобы сохранить» */}
      {iosHint && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500">
          <div className="flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-2xl shadow-2xl font-semibold text-xs max-w-[90vw]">
            <span className="text-lg">📲</span>
            <div className="leading-tight">
              <p className="font-black mb-0.5">Сохраните фото</p>
              <p className="opacity-80">Удерживайте картинку → «Сохранить в Фото»</p>
            </div>
          </div>
        </div>
      )}

      {/* === ШАГ 4: РЕЗУЛЬТАТ === */}
      {step === 'result' && resultImage && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-sans uppercase tracking-tighter mb-1">Готово</h2>
            <p className="text-sm text-muted-foreground font-serif">{resultStyleName}</p>
          </div>

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full p-0 m-0 border-0 bg-transparent rounded-3xl overflow-hidden border border-border shadow-2xl cursor-zoom-in"
            aria-label="Открыть фото на весь экран"
          >
            <img src={resultImage} alt="Сгенерированное фото" className="w-full h-auto block" />
          </button>

          {/* Предупреждение 152-ФЗ */}
          <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/30 text-xs text-foreground/90 leading-relaxed">
            ⚠️ <strong>Скачайте сейчас.</strong> Фото нигде не сохраняется — после закрытия страницы оно будет недоступно.
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="block w-full py-5 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-wider text-base text-center hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
          >
            {isDownloading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                Скачивание…
              </span>
            ) : '↓ Скачать фото'}
          </button>

          <button
            onClick={handleNext}
            className="w-full py-3 rounded-2xl border border-border text-foreground font-medium uppercase tracking-wider text-sm hover:bg-secondary/40 transition-all"
          >
            {balance > 0 ? `Сгенерировать ещё (осталось ${balance})` : 'Купить ещё фото'}
          </button>
        </div>
      )}

      {/* Lightbox: фото на весь экран. На мобильных — long-press → «Сохранить в Фото» */}
      {lightboxOpen && resultImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center backdrop-blur-md active:scale-90 transition-transform"
            aria-label="Закрыть"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <img
            src={resultImage}
            alt="Сгенерированное фото"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
          <a
            href={resultImage}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-5 py-3 rounded-full bg-white text-black text-xs font-bold backdrop-blur-md active:scale-95 transition-transform shadow-xl"
            aria-label="Открыть оригинал в новой вкладке"
          >
            Открыть оригинал
          </a>
        </div>
      )}
    </section>
  );
}

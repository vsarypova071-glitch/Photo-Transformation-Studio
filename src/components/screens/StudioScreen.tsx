// 🟢 STAGE WALLET 1.4 — главный экран модели «кошелёк»
// Шаги: загрузка фото → согласие на биометрию (152-ФЗ) → выбор 1 стиля
// → кнопка «Сгенерировать (-1)» → показ фото с большой кнопкой «Скачать»
// + предупреждение «фото нигде не сохраняется».

import { useState, useEffect, useRef } from 'react';
import { STYLES } from '@/lib/constants';
import { studio } from '@/services/studio';
import { createLogger } from '@/utils/logger';
import { downloadGeneratedPhoto, detectDevice } from '@/utils/download';
import ReferralBlock from '@/components/ReferralBlock';

// Стоимость парной генерации (должно совпадать с PAIR_CREDITS на бэкенде)
const PAIR_CREDITS = 2;

const log = createLogger('StudioScreen');

// 1 генерация / 2 генерации / 5 генераций
function pluralGen(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'генерация';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'генерации';
  return 'генераций';
}

interface StudioScreenProps {
  customerKey: string;
  initialBalance: number;
  onBalanceChange: (newBalance: number) => void;
  onBuyMore: () => void;
  onGeneratingChange?: (generating: boolean) => void;
  // Prefill после оплаты — пропускаем шаг загрузки фото и выбор стиля
  prefillPhotoUrl?: string;
  prefillStyleId?: string;
}

type Step = 'upload' | 'choose' | 'generating' | 'result';

export default function StudioScreen({
  customerKey,
  initialBalance,
  onBalanceChange,
  onBuyMore,
  onGeneratingChange,
  prefillPhotoUrl,
  prefillStyleId,
}: StudioScreenProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [step, setStep] = useState<Step>('upload');

  // upload — Фото A (основное, используется и для single и для pair)
  const [uploadedImage, setUploadedImage] = useState<string>(''); // base64 (для превью)
  const [uploadedUrl, setUploadedUrl] = useState<string>('');     // URL результата на VPS
  const [uploadedFilename, setUploadedFilename] = useState<string>(''); // имя файла на VPS — для /api/generation/single
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | undefined>();
  const [biometryConsent, setBiometryConsent] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // upload — Фото B (только для парных стилей)
  const [uploadedImageB, setUploadedImageB] = useState<string>('');
  const [uploadedFilenameB, setUploadedFilenameB] = useState<string>('');
  const [isUploadingB, setIsUploadingB] = useState(false);

  // popup о TTL результата
  const [showTtlNotice, setShowTtlNotice] = useState(false);
  const [resultTtlMinutes, setResultTtlMinutes] = useState(30);

  // choose
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [isFullBody, setIsFullBody] = useState(false);
  const [genderMode, setGenderMode] = useState<'female' | 'male'>('female');

  // result
  const [resultImage, setResultImage] = useState<string>('');
  const [resultStyleName, setResultStyleName] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // common
  const [error, setError] = useState<string | null>(null);

  // Сообщаем родителю когда идёт генерация — чтобы авто-reload не сорвал её
  useEffect(() => {
    onGeneratingChange?.(step === 'generating');
  }, [step, onGeneratingChange]);

  // Prefill после оплаты: подставляем фото и стиль из заказа.
  // Срабатывает ОДИН раз — флаг prefillConsumedRef защищает от повторов
  // при ре-рендерах. Юзер сразу попадает на шаг "выбор стиля", где
  // фото уже превью и кнопка "Сгенерировать" активна.
  const prefillConsumedRef = useRef(false);
  useEffect(() => {
    if (prefillConsumedRef.current) return;
    if (!prefillPhotoUrl) return;
    prefillConsumedRef.current = true;
    log.info('PREFILL applied', { prefillPhotoUrl, prefillStyleId });

    // Фото юзера приходит сюда с Supabase Storage URL (legacy перед оплатой).
    // Нужно скачать и заново залить в /api/photos чтобы получить filename для Beget.
    (async () => {
      try {
        setIsUploading(true);
        const r = await fetch(prefillPhotoUrl);
        if (!r.ok) throw new Error(`prefill fetch failed: ${r.status}`);
        const blob = await r.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setUploadedImage(base64);
        const up = await studio.uploadPhoto(base64);
        setUploadedUrl(up.url);
        setUploadedFilename(up.filename);
        setOriginalDimensions(up.dimensions);
        setBiometryConsent(true);
        if (prefillStyleId) setSelectedStyleId(prefillStyleId);
        setStep('choose');
      } catch (e: any) {
        log.warn('Prefill upload failed, falling back to manual upload', e);
        // оставляем юзера на шаге upload с пустым полем
      } finally {
        setIsUploading(false);
      }
    })();
  }, [prefillPhotoUrl, prefillStyleId]);

  const sessionId = (() => {
    let id = sessionStorage.getItem('anon_user_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2);
      sessionStorage.setItem('anon_user_id', id);
    }
    return id;
  })();

  // Определяем режим: pair если выбранный стиль принадлежит категории 'together'
  const selectedStyleObj = STYLES.find(s => s.id === selectedStyleId);
  const isPairMode = selectedStyleObj?.category === 'together';

  // === Шаг 1: загрузка фото A ===
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

      const up = await studio.uploadPhoto(base64);
      setUploadedUrl(up.url);
      setUploadedFilename(up.filename);
      setOriginalDimensions(up.dimensions);
      setStep('choose');
    } catch (err: any) {
      log.error('Upload failed', err);
      setError(err.message || 'Не удалось загрузить фото');
      setUploadedImage('');
    } finally {
      setIsUploading(false);
    }
  };

  // === Шаг 1b: загрузка фото B (только для pair styles) ===
  const handleFileChangeB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploadingB(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadedImageB(base64);

      const up = await studio.uploadPhoto(base64);
      setUploadedFilenameB(up.filename);
    } catch (err: any) {
      log.error('Upload B failed', err);
      setError(err.message || 'Не удалось загрузить второе фото');
      setUploadedImageB('');
    } finally {
      setIsUploadingB(false);
    }
  };

  // === Шаг 2: выбор стиля и генерация (single и pair) ===
  const handleGenerate = async () => {
    if (!selectedStyleId) {
      setError('Выберите стиль');
      return;
    }

    const style = STYLES.find(s => s.id === selectedStyleId);
    if (!style) {
      setError('Стиль не найден');
      return;
    }

    const requiredCredits = isPairMode ? PAIR_CREDITS : 1;

    if (balance < requiredCredits) {
      setError(isPairMode
        ? `Для парного фото нужно минимум ${PAIR_CREDITS} генерации`
        : 'Закончились генерации');
      return;
    }

    if (!uploadedFilename) {
      setError('Сначала загрузите фото');
      setStep('upload');
      return;
    }

    if (isPairMode && !uploadedFilenameB) {
      setError('Загрузите фото второго человека');
      return;
    }

    setError(null);
    setStep('generating');

    try {
      let res: Awaited<ReturnType<typeof studio.generateOne>>;

      if (isPairMode) {
        // --- Парная генерация ---
        res = await studio.generatePair({
          customerKey,
          styleId: style.id,
          sourcePhotoFilenameA: uploadedFilename,
          sourcePhotoFilenameB: uploadedFilenameB,
        });
      } else {
        // --- Одиночная генерация ---
        res = await studio.generateOne({
          customerKey,
          styleId: style.id,
          sourcePhotoFilename: uploadedFilename,
          isFullBody,
          genderMode,
          originalDimensions,
        });
      }

      setResultImage(res.imageUrl);
      setResultStyleName(style.name);
      setResultTtlMinutes(res.ttlMinutes ?? 30);
      setBalance(res.balance);
      onBalanceChange(res.balance);
      setStep('result');
      setShowTtlNotice(true);
    } catch (err: any) {
      log.error('Generation failed', err);
      const msg = err?.error || err?.message || 'Ошибка генерации';
      const refunded = err?.refunded;
      const refundedAmt = err?.refundedAmount ?? (isPairMode ? PAIR_CREDITS : 1);
      setError(refunded
        ? `${msg} ${refundedAmt > 1 ? `${refundedAmt} генерации возвращены` : 'Генерация возвращена'} на баланс.`
        : msg);
      if (typeof err?.balance === 'number') {
        setBalance(err.balance);
        onBalanceChange(err.balance);
      } else {
        const info = await studio.getBalance(customerKey);
        setBalance(info.balance);
        onBalanceChange(info.balance);
      }
      setStep('choose');
    }
  };

  // === Скачивание фото — приоритет на системное «Поделиться» ===
  // Скачивание реализовано в utils/download.ts:
  //   - desktop / Android  →  <a href="/api/photos/download/<file>" download>  (Content-Disposition: attachment)
  //   - iOS                →  navigator.share с File (Save to Files / Photos),
  //                           fallback на тот же download endpoint
  // Сервер отдаёт правильный Content-Type, Content-Length и attachment-имя
  // ai-fotosessia-result-YYYYMMDD-HHMM.jpg.
  const handleDownload = async () => {
    if (!resultImage || isDownloading) return;
    setIsDownloading(true);

    try {
      const res = await downloadGeneratedPhoto(resultImage);
      log.info('Download triggered', res);

      if (res.via === 'web-share') {
        // iOS Share Sheet взял на себя — юзер сам выбрал «Сохранить в Фото»
      } else if (res.via === 'anchor-download') {
        // browser стал скачивать — показываем подтверждающий toast
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 4000);
      } else {
        // open-window: подсказываем что в открывшейся вкладке нажать сохранить
        setIosHint(true);
        setTimeout(() => setIosHint(false), 6000);
      }
    } catch (err) {
      log.error('Download failed', err);
      // самый последний fallback — лайтбокс с long-press как ручной способ
      setLightboxOpen(true);
    } finally {
      setIsDownloading(false);
    }
  };

  // === После результата — обратно к выбору стиля ===
  const handleNext = () => {
    setResultImage('');
    setResultStyleName('');
    // Сбрасываем фото B — пользователь выбирает новый стиль
    setUploadedImageB('');
    setUploadedFilenameB('');
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
          <p className="text-2xl font-bold text-primary">{balance} <span className="text-xs text-muted-foreground">{pluralGen(balance)}</span></p>
        </div>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Phase 4 — Реферальный блок. Показывается только если flag включён
          (внутри компонента + бэкенд). Для текущего prod (flag=false)
          ReferralBlock рендерится null, ничего не меняется. */}
      <ReferralBlock customerKey={customerKey} />

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
              Я даю согласие на обработку фото лица для AI‑генерации
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

          {/* Gender toggle */}
          <div className="flex rounded-full bg-secondary border border-border p-1 gap-1">
            {(['female', 'male'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGenderMode(mode)}
                className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  genderMode === mode
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground'
                }`}
              >
                {mode === 'female' ? 'Женский' : 'Мужской'}
              </button>
            ))}
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

          {/* Зона загрузки второго фото — только для парных стилей */}
          {isPairMode && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                👥 Фото второго человека
              </p>

              {uploadedImageB ? (
                // Превью фото B + кнопка замены
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                  <img
                    src={uploadedImageB}
                    alt="Второй человек"
                    className="w-14 h-14 rounded-lg object-cover border border-border"
                  />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Фото 2 загружено</p>
                    <label className="text-xs text-primary hover:underline cursor-pointer mt-1 block">
                      Заменить
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChangeB}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {isUploadingB && (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                  )}
                </div>
              ) : (
                // Зона загрузки фото B
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isUploadingB ? 'opacity-60 cursor-wait' : 'border-border hover:border-primary/60 bg-secondary/20 hover:bg-secondary/40'}`}>
                  {isUploadingB ? (
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 border border-primary/20">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Загрузить фото 2</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Второй человек</p>
                      </div>
                    </>
                  )}
                  {!isUploadingB && (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChangeB}
                      className="hidden"
                    />
                  )}
                </label>
              )}

              {/* Предупреждение о качестве */}
              <p className="text-[9px] text-muted-foreground leading-relaxed px-1">
                ⚠️ В парных фото лица могут отличаться от оригинала сильнее, чем в обычном режиме.
              </p>
            </div>
          )}

          {/* Кнопка генерации */}
          <button
            onClick={handleGenerate}
            disabled={
              !selectedStyleId ||
              balance < (isPairMode ? PAIR_CREDITS : 1) ||
              (isPairMode && !uploadedFilenameB)
            }
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
          >
            {isPairMode
              ? (balance < PAIR_CREDITS
                  ? `Нужно минимум ${PAIR_CREDITS} генерации`
                  : !uploadedFilenameB
                    ? 'Загрузите второе фото'
                    : `Сгенерировать (−${PAIR_CREDITS} фото)`)
              : (balance < 1 ? 'Закончились генерации' : `Сгенерировать (−1 фото)`)
            }
          </button>

          {balance < (isPairMode ? PAIR_CREDITS : 1) && (
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

      {/* Тост-подтверждение успешного скачивания */}
      {savedToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500">
          <div className="flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold text-xs max-w-[90vw]">
            <span className="text-lg">✅</span>
            <div className="leading-tight">
              <p className="font-black mb-0.5">Фото сохранено</p>
              <p className="opacity-90">Проверьте папку «Загрузки» или Галерею</p>
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-5 py-3 rounded-full bg-white text-black text-xs font-bold backdrop-blur-md shadow-xl text-center max-w-[90vw]"
          >
            Если кнопка не сработала: удерживайте фото → «Сохранить изображение»
          </div>
        </div>
      )}

      {/* Popup: фото живут 30 минут на VPS */}
      {showTtlNotice && (
        <div
          className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
          onClick={() => setShowTtlNotice(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-3xl border-2 border-yellow-400/60 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <h3 className="text-lg font-black text-yellow-300 mb-2">
                Фото доступны {resultTtlMinutes} минут
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed mb-5">
                Скачайте сразу — после {resultTtlMinutes} минут файл будет автоматически удалён с сервера.
                <br />
                <span className="text-xs text-muted-foreground">
                  Это требование 152-ФЗ: фото нигде не хранится постоянно.
                </span>
              </p>
              <button
                onClick={() => setShowTtlNotice(false)}
                className="w-full py-3 rounded-xl bg-yellow-400 text-black font-bold text-sm uppercase tracking-wider active:scale-[0.98] transition"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

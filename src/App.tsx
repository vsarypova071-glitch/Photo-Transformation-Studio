import { useState, useEffect, useCallback, useRef } from 'react';
import { backend } from './services/backend';
import { Job, Style, StudioTab } from './types';
import { createLogger } from './utils/logger';
import {
  createPayment,
  checkOrder,
  findRecentOrder,
  getBalance as apiGetBalance,
  uploadPhoto,
} from './services/api';
import { fetchStyles, getStylesSync } from './services/styles';
import {
  readReferralFromUrl,
  trackOnLanding,
  getStoredReferralCode,
} from './services/referrals';


import WelcomeScreen from './components/screens/WelcomeScreen';
import GoalScreen from './components/screens/GoalScreen';
import UploadScreen from './components/screens/UploadScreen';
import StylesScreen from './components/screens/StylesScreen';
import TariffScreen from './components/screens/TariffScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import StudioScreen from './components/screens/StudioScreen';
import { studio } from './services/studio';

const log = createLogger('App');

export type Screen = 'welcome' | 'goal' | 'upload' | 'styles' | 'tariff' | 'processing' | 'results' | 'studio';

interface SelectedTariff {
  id: string;
  name: string;
  photos: number;
  price: number;
}

function getSessionId(): string {
  let id = sessionStorage.getItem('anon_user_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).substring(2);
    sessionStorage.setItem('anon_user_id', id);
  }
  return id;
}

function getCustomerKey(): string {
  let key = localStorage.getItem('customer_key');
  if (!key) {
    key = 'cust_' + crypto.randomUUID();
    localStorage.setItem('customer_key', key);
  }
  return key;
}

// Предзагрузка фото на VPS перед оплатой. URL сохраняется в заказе,
// чтобы после оплаты StudioScreen мог сразу перейти на шаг выбора стиля.
// TTL фото на VPS — 30 минут. Если загрузка упала — оплата всё равно проходит:
// пользователь просто загрузит фото снова в Studio.
async function uploadPhotoBeforePayment(blob: Blob): Promise<string | null> {
  try {
    const result = await uploadPhoto(blob);
    return result.url;
  } catch (e: any) {
    log.warn('Pre-payment photo upload failed, continuing without photo URL', { error: e?.message });
    return null;
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  // Стили: сначала из cache/bundle (синхронно), затем фоном обновляем из /api/styles.
  // Если API недоступен/пустой — остаётся bundle, юзер ничего не теряет.
  const [styles, setStyles] = useState<Style[]>(() => getStylesSync());
  useEffect(() => {
    fetchStyles().then((items) => {
      if (items.length > 0) setStyles(items);
    }).catch(() => {/* bundle уже стоит */});

    // Phase 4 — referral landing: сохраняем ?ref= в localStorage и
    // отправляем POST /api/referrals/track. Если фича на бэке выключена,
    // endpoint вернёт 404 — функция спокойно проглотит это.
    const refCode = readReferralFromUrl();
    if (refCode) {
      trackOnLanding(getCustomerKey()).catch(() => {/* ignore */});
    }
  }, []);
  const [uploadedImage, setUploadedImage] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<StudioTab>('female');
  const [intensity, setIntensity] = useState(70);
  const [isFullBody, setIsFullBody] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<SelectedTariff | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [orderResults, setOrderResults] = useState<string[]>([]);
  // Store order-based job directly (not from sessionStorage)
  const [orderJob, setOrderJob] = useState<Job | null>(null);
  // STAGE 1.2 — block double clicks on payment button
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  // STAGE 2.2 — soft prompt to resume found paid order on different device / cleared cache
  const [recentOrderPrompt, setRecentOrderPrompt] = useState<{
    orderId: string;
    generationStatus: string;
    photosCount: number;
    results: string[];
    originalImage?: string | null;
    styleIds?: string[];
    price?: number;
    paymentMethod?: 'rub' | 'credits';
  } | null>(null);
  // 🟢 STAGE WALLET 1.4 — баланс кошелька (загружается при старте по customer_key)
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoaded, setWalletLoaded] = useState<boolean>(false);
  // Prefill для Studio после оплаты — фото и стиль из заказа.
  // Юзер не загружает второй раз и не выбирает стиль заново.
  const [prefilledStudio, setPrefilledStudio] = useState<{
    photoUrl: string;
    styleId?: string;
  } | null>(null);

  // Авто-обновление бандла: имя текущего JS + флаг «идёт генерация в Studio»
  const bundleHashRef = useRef<string | null>(null);
  const studioGeneratingRef = useRef<boolean>(false);

  // === АВТО-ОБНОВЛЕНИЕ ===
  // Сравнивает имя текущего JS-бандла с тем, что отдаёт сервер.
  // Если разные — перезагружает страницу. Юзеру не нужно чистить кэш.
  // Не перезагружаем на чувствительных экранах: tariff (оплата),
  // processing (генерация заказа), studio во время одиночной генерации.
  useEffect(() => {
    if (bundleHashRef.current === null) {
      const scripts = Array.from(document.querySelectorAll('script[type="module"][src]'));
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        if (src.endsWith('.js') || src.includes('/assets/')) {
          bundleHashRef.current = src.split('?')[0].split('/').pop() || null;
          break;
        }
      }
    }
    if (!bundleHashRef.current) return; // dev mode (main.tsx) — пропускаем

    const isUnsafeScreen = () => {
      if (screen === 'tariff' || screen === 'processing') return true;
      if (screen === 'studio' && studioGeneratingRef.current) return true;
      return false;
    };

    const checkAndReload = async () => {
      if (isUnsafeScreen()) return;
      try {
        const resp = await fetch('/?_v=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return;
        const html = await resp.text();
        const m = html.match(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/i);
        if (!m) return;
        const remoteName = m[1].split('?')[0].split('/').pop();
        if (remoteName && remoteName !== bundleHashRef.current) {
          log.info('New build detected, reloading', { current: bundleHashRef.current, remote: remoteName });
          window.location.reload();
        }
      } catch {
        // network/parse error — игнорим
      }
    };

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (Date.now() - hiddenAt > 30_000) {
        checkAndReload();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(checkAndReload, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [screen]);

  const navigateTo = (newScreen: Screen) => {
    log.info('Navigate', { from: screen, to: newScreen });
    setScreen(newScreen);
    window.scrollTo(0, 0);
  };

  // 🟢 STAGE WALLET: после оплаты пакета webhook начисляет кредиты и ставит
  // generation_status='credits_credited'. Здесь — общий хэндлер: подтянуть
  // баланс, очистить orderId и переключить юзера в Studio.
  // prefill — данные из заказа (фото и первый стиль), чтобы Studio
  // открылась сразу с шагом «Сгенерировать», без повторной загрузки.
  const handleCreditsCredited = useCallback(async (
    orderId: string,
    prefill?: { photoUrl?: string | null; styleId?: string | null }
  ) => {
    log.info('Order credited as wallet topup', { orderId, prefill });
    localStorage.removeItem('current_order_id');
    setCurrentOrderId(null);
    setPaymentError(null);
    setProcessingError(null);
    try {
      const customerKey = getCustomerKey();
      const info = await studio.getBalance(customerKey);
      setWalletBalance(info.balance);
    } catch (e) {
      log.warn('Balance refresh after topup failed', e);
    }
    if (prefill?.photoUrl) {
      setPrefilledStudio({
        photoUrl: prefill.photoUrl,
        styleId: prefill.styleId || undefined,
      });
    }
    setScreen('studio');
    window.scrollTo(0, 0);
  }, []);

  // Poll order status after payment
  const pollOrderStatus = useCallback((orderId: string) => {
    log.info('Polling order', { orderId });
    let pollCount = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const stopAll = () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const data = await checkOrder(orderId);
        log.info('Order status', data);

        // 🟢 STAGE WALLET: оплачен пакет → кредиты начислены → ведём в Studio
        if (data.generationStatus === 'credits_credited') {
          stopAll();
          await handleCreditsCredited(orderId, {
            photoUrl: data.originalImage,
            styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : undefined,
          });
          return;
        }

        // STAGE 3.2: refunded — money/credits returned, gentle message
        if (data.paymentStatus === 'refunded') {
          stopAll();
          localStorage.removeItem('current_order_id');
          setPaymentError('Генерация не удалась — деньги/кредиты вернули вам автоматически. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // Handle canceled/expired payment
        if (data.paymentStatus === 'canceled' || data.paymentStatus === 'expired') {
          stopAll();
          localStorage.removeItem('current_order_id');
          setPaymentError('Оплата не прошла. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // CRITICAL: paid order with generation error → DO NOT redirect to payment!
        // Show processing screen with retry button instead.
        if (data.generationStatus === 'error' && data.paymentStatus === 'succeeded') {
          stopAll();
          setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
          // stay on processing screen
          return;
        }

        // Non-paid generation error/canceled
        if (data.generationStatus === 'error' || data.generationStatus === 'canceled') {
          stopAll();
          localStorage.removeItem('current_order_id');
          setPaymentError('Ошибка генерации. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // Handle done with results
        if (data.generationStatus === 'done' && data.results?.length > 0) {
          stopAll();
          setOrderResults(data.results);

          // Create job object directly — no sessionStorage
          const job: Job = {
            id: 'order_' + orderId,
            userId: getSessionId(),
            status: 'done',
            styleIds: selectedStyles,
            isFullBody,
            originalImage: uploadedImage,
            results: data.results,
            createdAt: Date.now(),
            // STAGE 3.1: enable partial-result UI
            expectedCount: data.photosCount,
            priceRub: data.price,
            paymentMethod: data.paymentMethod,
          };
          setOrderJob(job);
          setCurrentJobId(job.id);
          navigateTo('results');
          return;
        }

        // If still pending after 5 polls (15 sec), payment wasn't completed
        if (data.paymentStatus === 'pending' && pollCount > 5) {
          stopAll();
          setPaymentError('Оплата не подтверждена. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }
      } catch (e) {
        log.error('Poll error', e);
      }
    }, 3000);

    // Stop polling after 2 minutes; check balance in case webhook was slow
    timeoutId = setTimeout(async () => {
      clearInterval(interval);
      try {
        const ck = getCustomerKey();
        const info = await studio.getBalance(ck);
        if (info.balance > 0) {
          await handleCreditsCredited(orderId, {});
          return;
        }
      } catch (_) { /* ignore */ }
      setProcessingError('Платёж получен, но начисление кредитов задерживается. Нажмите «Попробовать снова» — кредиты проверим автоматически.');
    }, 120000);
  }, [selectedStyles, isFullBody, uploadedImage, handleCreditsCredited]);

  // Restore order from localStorage on mount
  useEffect(() => {
    // Fresh payment return is handled by the dedicated ?order_id= effect below.
    // Do not restore an older saved order first, otherwise users can land on a stale error screen.
    const params = new URLSearchParams(window.location.search);
    if (params.get('order_id')) return;

    const savedOrderId = localStorage.getItem('current_order_id');
    if (savedOrderId && !currentOrderId) {
      log.info('Restoring order from localStorage', { orderId: savedOrderId });
      setCurrentOrderId(savedOrderId);
      restoreOrder(savedOrderId);
      return;
    }

    // STAGE 2.2: no local order — try to find a recent paid one by customer_key.
    // Covers: cleared cache, new browser, second device with same localStorage cust_ key.
    // Skip if we're returning from payment (?order_id= in URL) — that's handled separately.
    const customerKey = localStorage.getItem('customer_key');
    if (!customerKey) return;

    (async () => {
      try {
        const data = await findRecentOrder(customerKey);
        if (data.found && data.orderId) {
          log.info('Found recent paid order by customer_key', { orderId: data.orderId, gen: data.generationStatus });
          if (data.generationStatus === 'credits_credited') {
            // Credits already in wallet — balance effect will load the count,
            // WelcomeScreen shows the "continue to studio" button without auto-redirect.
            return;
          }
          setRecentOrderPrompt({
            orderId: data.orderId,
            generationStatus: data.generationStatus ?? '',
            photosCount: data.photosCount ?? 0,
            results: data.results || [],
            originalImage: data.originalImage,
            styleIds: Array.isArray(data.styleIds) ? data.styleIds : [],
            price: data.price,
            paymentMethod: data.paymentMethod,
          });
        }
      } catch (e) {
        log.warn('find-recent-order failed', e);
      }
    })();
  }, [handleCreditsCredited]);

  // 🟢 STAGE WALLET 1.4 — загрузка баланса кошелька при старте
  // Не мешаем восстановлению старых заказов (current_order_id) и URL ?order_id=.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order_id')) {
      setWalletLoaded(true);
      return;
    }
    if (localStorage.getItem('current_order_id')) {
      setWalletLoaded(true);
      return;
    }

    const customerKey = localStorage.getItem('customer_key');
    if (!customerKey) {
      setWalletLoaded(true);
      return;
    }

    (async () => {
      try {
        const info = await studio.getBalance(customerKey);
        log.info('Wallet balance loaded', { balance: info.balance, exists: info.exists });
        setWalletBalance(info.balance);
      } catch (e) {
        log.warn('Wallet balance load failed', e);
      } finally {
        setWalletLoaded(true);
      }
    })();
  }, []);

  // STAGE 2.2: user accepted "Resume your order" prompt
  const acceptRecentOrder = () => {
    if (!recentOrderPrompt) return;
    const { orderId, generationStatus, results } = recentOrderPrompt;
    setRecentOrderPrompt(null);

    if (generationStatus === 'credits_credited') {
      handleCreditsCredited(orderId, {
        photoUrl: recentOrderPrompt.originalImage,
        styleId: recentOrderPrompt.styleIds?.[0],
      });
      return;
    }

    setCurrentOrderId(orderId);
    localStorage.setItem('current_order_id', orderId);

    if (generationStatus === 'error') {
      setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
      setScreen('processing');
    } else {
      // running / waiting
      setScreen('processing');
      pollOrderStatus(orderId);
    }
  };

  const dismissRecentOrder = () => {
    setRecentOrderPrompt(null);
  };

  const restoreOrder = async (orderId: string) => {
    try {
      const data = await checkOrder(orderId);

      // 🟢 STAGE WALLET: пакет оплачен → кредиты в кошельке → в Studio
      if (data.generationStatus === 'credits_credited') {
        await handleCreditsCredited(orderId, {
          photoUrl: data.originalImage,
          styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : undefined,
        });
        return;
      }

      // Legacy 'done' batch results no longer auto-open in restoreOrder — credit flow only.



      // STAGE 3.2: refunded — show on tariff with friendly message
      if (data.paymentStatus === 'refunded') {
        localStorage.removeItem('current_order_id');
        setPaymentError('Прошлый заказ не сгенерировался — деньги/кредиты вернули вам автоматически. Можете попробовать снова.');
        setScreen('tariff');
        return;
      }

      if (data.paymentStatus === 'canceled' || data.paymentStatus === 'expired') {
        localStorage.removeItem('current_order_id');
        return;
      }

      // CRITICAL: paid + error → keep order, show processing with retry. Do NOT clear localStorage.
      if (data.paymentStatus === 'succeeded' && data.generationStatus === 'error') {
        setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
        setScreen('processing');
        return;
      }

      // Unpaid generation error
      if (data.generationStatus === 'error' || data.generationStatus === 'canceled') {
        localStorage.removeItem('current_order_id');
        return;
      }

      // Still running — show processing
      if (data.paymentStatus === 'succeeded' && (data.generationStatus === 'running' || data.generationStatus === 'waiting')) {
        setScreen('processing');
        pollOrderStatus(orderId);
      }
    } catch (e) {
      log.error('Restore order failed', e);
    }
  };

  // Check URL for returning from payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    if (orderId) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      setCurrentOrderId(orderId);
      // Save to localStorage for persistence
      localStorage.setItem('current_order_id', orderId);

      // First check order status before showing processing
      (async () => {
        try {
          const data = await checkOrder(orderId);

          // Variant B: cross-device — если оплата была с другого устройства,
          // берём customer_key из заказа и синхронизируем localStorage.
          // Так кредиты будут доступны в Studio на текущем устройстве.
          if (data.customerKey && data.customerKey !== localStorage.getItem('customer_key')) {
            localStorage.setItem('customer_key', data.customerKey);
          }

          // 🟢 STAGE WALLET: пакет оплачен → кредиты в кошельке → в Studio
          if (data.generationStatus === 'credits_credited') {
            await handleCreditsCredited(orderId, {
              photoUrl: data.originalImage,
              styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : undefined,
            });
            return;
          }

          // Legacy 'done' batch results no longer auto-open after payment return — credit flow only.



          // STAGE 3.2: refunded — friendly message + back to tariff
          if (data.paymentStatus === 'refunded') {
            localStorage.removeItem('current_order_id');
            setPaymentError('Генерация не удалась — деньги/кредиты вернули вам автоматически. Попробуйте снова.');
            setScreen('tariff');
            return;
          }

          // Canceled or expired — back to tariff
          if (data.paymentStatus === 'canceled' || data.paymentStatus === 'expired') {
            localStorage.removeItem('current_order_id');
            setPaymentError('Оплата не прошла. Попробуйте снова.');
            setScreen('tariff');
            return;
          }

          // CRITICAL: paid + error → keep order, show processing + retry. NEVER redirect to payment.
          if (data.paymentStatus === 'succeeded' && data.generationStatus === 'error') {
            setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
            setScreen('processing');
            return;
          }

          // Unpaid generation error
          if (data.generationStatus === 'error' || data.generationStatus === 'canceled') {
            localStorage.removeItem('current_order_id');
            setPaymentError('Ошибка генерации. Попробуйте снова.');
            setScreen('tariff');
            return;
          }

          // Paid and still generating — show processing and poll
          if (data.paymentStatus !== 'pending') {
            setScreen('processing');
            pollOrderStatus(orderId);
          } else {
            // User returned from YooKassa without completing payment
            localStorage.removeItem('current_order_id');
            setCurrentOrderId(null);
            setPaymentError('Оплата не завершена. Выберите тариф и попробуйте снова.');
            setScreen('tariff');
          }
        } catch (e) {
          log.error('Initial order check failed', e);
          setScreen('processing');
          pollOrderStatus(orderId);
        }
      })();
    }
  }, [pollOrderStatus]);

  const handleSelectTariff = async (tariff: SelectedTariff, customerEmail: string) => {
    // STAGE 1.2 — prevent double payment creation
    if (isCreatingPayment) {
      log.info('Payment creation already in progress — ignoring duplicate click');
      return;
    }
    setIsCreatingPayment(true);
    setSelectedTariff(tariff);
    setPaymentError(null);
    log.info('Creating payment', { tariff: tariff.name, price: tariff.price });

    try {
      const sessionId = getSessionId();

      // Upload photo to VPS so order records the URL.
      // After payment, StudioScreen uses it to skip the re-upload step (prefill).
      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const imageStoragePath: string | null = await uploadPhotoBeforePayment(blob);
      log.info('Pre-payment photo upload', { success: !!imageStoragePath });

      let data;
      try {
        data = await createPayment({
          tariffId: tariff.id as 'basic' | 'standard' | 'premium',
          userSessionId: sessionId,
          customerKey: getCustomerKey(),
          customerEmail,
          styleIds: selectedStyles,
          originalImageUrl: imageStoragePath,
          customPrompt: '',
          isFullBody,
          // Phase 4: реферальный код, если юзер пришёл по ?ref=...
          // Бэк сам валидирует формат, отсеивает self-referral и игнорирует
          // если ENABLE_REFERRALS=false.
          referralCode: getStoredReferralCode() ?? undefined,
        });
      } catch (apiErr: any) {
        const status = apiErr?.status ?? 500;
        const code = apiErr?.body?.code;
        const msg = apiErr?.body?.error || apiErr?.message;
        if (status === 409 && code === 'balance_not_empty') {
          const balance = apiErr?.body?.balance ?? 0;
          if (typeof balance === 'number') setWalletBalance(balance);
          setIsCreatingPayment(false);
          // Не перекидываем молча — показываем понятное сообщение на экране тарифов.
          // TariffScreen покажет баннер "активный пакет" + кнопку "Перейти в студию".
          setPaymentError(`У вас ${balance} ${balance === 1 ? 'генерация' : balance < 5 ? 'генерации' : 'генераций'} — оплата не нужна. Нажмите «Перейти к генерации» ниже.`);
          return;
        }
        if (status === 503) throw new Error(msg || 'Сервис временно перегружен. Попробуйте через несколько минут.');
        throw new Error(msg || 'Ошибка создания платежа');
      }

      // SAFEGUARD: server detected existing paid+unfinished order — reuse it, no new payment
      if (data.existingOrder && data.orderId) {
        log.info('Existing paid order detected', { orderId: data.orderId, generationStatus: data.generationStatus, results: data.results?.length });
          if (data.generationStatus === 'credits_credited') {
            setIsCreatingPayment(false);
            await handleCreditsCredited(data.orderId, {
              photoUrl: data.originalImage,
              styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : selectedStyles[0],
            });
            return;
          }

        setCurrentOrderId(data.orderId);
        localStorage.setItem('current_order_id', data.orderId);
        setPaymentError(null);
        // STAGE 1.2 — release lock since we're navigating away
        setIsCreatingPayment(false);

        // Backend больше не возвращает existingOrder для done/error/running —
        // только credits_credited (обработан выше) или reused pending YooKassa
        // (там вернётся paymentUrl, не existingOrder). На всякий случай —
        // если получили незнакомое состояние, ведём на processing.
        navigateTo('processing');
        pollOrderStatus(data.orderId);
        return;
      }

      if (!data.paymentUrl) {
        throw new Error('Сервис не вернул ссылку на оплату. Попробуйте снова.');
      }

      setCurrentOrderId(data.orderId);
      // Save order_id to localStorage before redirect
      localStorage.setItem('current_order_id', data.orderId);
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      log.error('Payment creation failed', e);
      const raw: string = e?.message ?? '';
      const isNetworkError =
        raw === 'Failed to fetch' ||
        raw.toLowerCase().includes('networkerror') ||
        raw.toLowerCase().includes('network request failed') ||
        raw.toLowerCase().includes('load failed');
      setPaymentError(
        isNetworkError
          ? 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.'
          : raw || 'Ошибка создания платежа. Попробуйте снова.'
      );
      // STAGE 1.2 — release lock on error so user can retry
      setIsCreatingPayment(false);
    }
  };

  const handleStartJob = async (customPrompt: string) => {
    if (!selectedTariff) {
      navigateTo('tariff');
      return;
    }

    navigateTo('processing');
    try {
      const job = await backend.createJob(
        uploadedImage,
        selectedStyles,
        customPrompt,
        intensity,
        isFullBody
      );
      setCurrentJobId(job.id);
      pollJob(job.id);
    } catch (e) {
      log.error('Job creation failed', e);
      alert("Ошибка старта. Проверьте соединение.");
      navigateTo('styles');
    }
  };

  const pollJob = (jobId: string) => {
    const interval = setInterval(async () => {
      const current = backend.getJobs().find(j => j.id === jobId);
      if (current) {
        if (current.status === 'done') {
          clearInterval(interval);
          navigateTo('results');
        } else if (current.status === 'error') {
          clearInterval(interval);
          alert("Ошибка генерации. Попробуйте другой стиль.");
          navigateTo('styles');
        }
      }
    }, 2000);
  };

  const handleRefine = async (prompt: string) => {
    const job = currentJob;
    if (job && job.results[0]) {
      navigateTo('processing');
      try {
        const newJob = await backend.refineJob(job.results[0], prompt);
        setCurrentJobId(newJob.id);
        setOrderJob(null); // Clear order job, now using backend job
        pollJob(newJob.id);
      } catch (e: any) {
        log.error('Refine failed', e);
        alert("Ошибка правки. Попробуйте ещё раз.");
        navigateTo('results');
      }
    }
  };

  const handleFullBody = async () => {
    const job = currentJob;
    if (!job || !job.results[0]) {
      alert("Нет исходного изображения для генерации.");
      return;
    }
    navigateTo('processing');
    try {
      const newJob = await backend.refineJob(
        job.results[0],
        "Extend this specific portrait to a full-length standing shot, showing the person from head to toe including matching high-end shoes, maintaining exactly the same style and face."
      );
      setCurrentJobId(newJob.id);
      setOrderJob(null);
      pollJob(newJob.id);
    } catch (e: any) {
      log.error('Full body failed', e);
      alert("Ошибка генерации во весь рост. Попробуйте ещё раз.");
      navigateTo('results');
    }
  };

  // Retry-generation на Beget пока не реализован (Phase 2 — миграция AI-генерации).
  // На текущем этапе пакетная генерация на бэкенде отключена: оплата → начисление кредитов →
  // юзер генерирует по одному фото в Studio. Если он попал на этот хендлер,
  // это означает заказ в статусе error. Ведём в Studio с актуальным балансом.
  // Retry-обработчик: проверяем статус заказа через VPS API и,
  // если кредиты уже начислены, ведём в Studio. Никаких Supabase Edge Functions.
  const handleRetryGeneration = async () => {
    setRetrying(true);
    setProcessingError(null);
    try {
      const customerKey = getCustomerKey();

      // Resolve orderId: state → localStorage → VPS lookup
      let orderIdToRetry = currentOrderId || localStorage.getItem('current_order_id');

      if (!orderIdToRetry) {
        try {
          const findData = await findRecentOrder(customerKey);
          if (findData?.found && findData?.generationStatus === 'credits_credited' && findData?.orderId) {
            await handleCreditsCredited(findData.orderId, {});
            return;
          }
          if (
            findData?.found &&
            findData?.paymentStatus === 'succeeded' &&
            findData?.generationStatus !== 'done' &&
            findData?.orderId
          ) {
            orderIdToRetry = findData.orderId;
          }
        } catch (e) {
          log.warn('find-recent-order during retry failed', e);
        }
      }

      if (!orderIdToRetry) {
        setProcessingError('Не удалось найти оплаченный заказ для повтора. Обратитесь в поддержку.');
        return;
      }

      // Проверяем статус заказа через VPS
      const statusData = await checkOrder(orderIdToRetry);
      if (statusData?.generationStatus === 'credits_credited') {
        await handleCreditsCredited(orderIdToRetry, {
          photoUrl: statusData.originalImage,
          styleId: Array.isArray(statusData.styleIds) ? statusData.styleIds[0] : undefined,
        });
        return;
      }

      // Sync state + storage
      if (orderIdToRetry !== currentOrderId) {
        setCurrentOrderId(orderIdToRetry);
      }
      localStorage.setItem('current_order_id', orderIdToRetry);

      // Проверяем баланс напрямую — вебхук мог начислить кредиты,
      // но статус заказа ещё не обновился.
      try {
        const info = await studio.getBalance(customerKey);
        if (info.balance > 0) {
          localStorage.removeItem('current_order_id');
          setCurrentOrderId(null);
          setProcessingError(null);
          setWalletBalance(info.balance);
          navigateTo('studio');
          return;
        }
      } catch (_) { /* ignore */ }

      setProcessingError('Кредиты ещё не начислены. Подождите 1–2 минуты или обновите страницу.');
    } catch (e: any) {
      log.error('Retry handler failed', e);
      setProcessingError('Не удалось обновить статус. Попробуйте перезагрузить страницу.');
    } finally {
      setRetrying(false);
    }
  };

  const handleAbandonOrder = () => {
    setCurrentOrderId(null);
    setProcessingError(null);
    localStorage.removeItem('current_order_id');
    navigateTo('tariff');
  };

  const handleNewPhoto = () => {
    setProcessingError(null);
    setUploadedImage('');
    setSelectedStyles([]);
    setSelectedTariff(null);
    setCurrentOrderId(null);
    setOrderResults([]);
    setOrderJob(null);
    localStorage.removeItem('current_order_id');
    navigateTo('upload');
  };

  // Resolve current job: prefer orderJob (from DB), fallback to backend sessionStorage jobs
  const currentJob: Job | undefined = orderJob || backend.getJobs().find(j => j.id === currentJobId);

  return (
    <div className="max-w-md mx-auto relative min-h-[100dvh] bg-background shadow-2xl">
      <main className="relative min-h-[100dvh]">
        {screen === 'studio' && (
          <StudioScreen
            customerKey={getCustomerKey()}
            initialBalance={walletBalance}
            onBalanceChange={setWalletBalance}
            onBuyMore={() => navigateTo('tariff')}
            onGeneratingChange={(g) => { studioGeneratingRef.current = g; }}
            prefillPhotoUrl={prefilledStudio?.photoUrl}
            prefillStyleId={prefilledStudio?.styleId}
            styles={styles}
          />
        )}

        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={() => navigateTo('goal')}
            walletBalance={walletBalance}
            onContinue={() => setScreen('studio')}
          />
        )}

        {screen === 'goal' && (
          <GoalScreen onSelectGoal={(goal) => { setSelectedGoal(goal); navigateTo('upload'); }} />
        )}
        
        {screen === 'upload' && (
          <UploadScreen 
            onImageSelected={(img) => {
              setUploadedImage(img);
              navigateTo('styles');
            }}
          />
        )}
        
        {screen === 'styles' && (
          <StylesScreen
            styles={styles}
            selectedStyles={selectedStyles}
            selectedGoal={selectedGoal}
            activeCategory={activeCategory}
            isFullBody={isFullBody}
            onSelectStyle={(id) => setSelectedStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])}
            onCategoryChange={setActiveCategory}
            onFullBodyToggle={() => setIsFullBody(!isFullBody)}
            onBack={() => navigateTo('upload')}
            onGenerate={() => navigateTo('tariff')}
          />
        )}

        {screen === 'tariff' && (
          <TariffScreen
            onSelectTariff={handleSelectTariff}
            onBack={() => navigateTo('styles')}
            paymentError={paymentError}
            isProcessing={isCreatingPayment}
            walletBalance={walletBalance}
            onGoToStudio={() => navigateTo('studio')}
          />
        )}
        
        {screen === 'processing' && (
          <ProcessingScreen
            errorMessage={processingError}
            retrying={retrying}
            onRetry={handleRetryGeneration}
            onAbandon={handleAbandonOrder}
          />
        )}
        
        {screen === 'results' && currentJob && (
          <ResultsScreen
            job={currentJob}
            onRefine={handleRefine}
            onFullBody={handleFullBody}
            onNewPhoto={handleNewPhoto}
            onBackToStyles={() => navigateTo('styles')}
          />
        )}
      </main>

      {/* STAGE 2.2: soft prompt to resume found paid order */}
      {recentOrderPrompt && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={dismissRecentOrder}
          />
          <div className="relative w-full max-w-md glass rounded-[2rem] p-7 border border-primary/30 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-5">
              <div className="text-3xl mb-3">✨</div>
              <h3 className="text-lg font-black text-foreground mb-2 leading-tight">
                У вас есть оплаченный заказ
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {recentOrderPrompt.generationStatus === 'done'
                  ? `Готовы ${recentOrderPrompt.results.length} фото из вашей фотосессии. Открыть результаты?`
                  : recentOrderPrompt.generationStatus === 'error'
                    ? 'Генерация не завершилась, но оплата сохранена. Попробуйте снова — без повторной оплаты.'
                    : 'Ваша фотосессия ещё генерируется. Открыть статус?'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={acceptRecentOrder}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition"
              >
                {recentOrderPrompt.generationStatus === 'done' ? 'Открыть фото' : 'Открыть заказ'}
              </button>
              <button
                onClick={dismissRecentOrder}
                className="w-full py-3 rounded-2xl text-muted-foreground text-xs font-semibold uppercase tracking-wider hover:text-foreground transition"
              >
                Не сейчас
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-20%] w-[120%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0" />
    </div>
  );
}

export default App;

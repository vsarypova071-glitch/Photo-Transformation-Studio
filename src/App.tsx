import { useState, useEffect, useCallback, useRef } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory, Job } from './types';
import { createLogger } from './utils/logger';


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

// 🔧 FIX upload "Failed to fetch": заливаем фото прямым POST на Storage REST,
// минуя SDK-fetch (который в preview-iframe иногда рушится TypeError'ом
// на больших blob'ах). Эндпоинт, политики и анон-ключ — те же.
async function uploadPhotoDirect(fileName: string, blob: Blob): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/user-photos/${fileName}`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anon}`,
        'apikey': anon,
        'Content-Type': blob.type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
      signal: controller.signal,
    });
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const j = await resp.json();
        msg = j?.message || j?.error || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/user-photos/${fileName}`;
    return publicUrl;
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('Сервис временно не отвечает, попробуйте ещё раз');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [uploadedImage, setUploadedImage] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<StyleCategory>('realistic');
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
    const interval = setInterval(async () => {
      pollCount++;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order?order_id=${orderId}`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await response.json();
        log.info('Order status', data);

        // 🟢 STAGE WALLET: оплачен пакет → кредиты начислены → ведём в Studio
        if (data.generationStatus === 'credits_credited') {
          clearInterval(interval);
          await handleCreditsCredited(orderId, {
            photoUrl: data.originalImage,
            styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : undefined,
          });
          return;
        }

        // STAGE 3.2: refunded — money/credits returned, gentle message
        if (data.paymentStatus === 'refunded') {
          clearInterval(interval);
          localStorage.removeItem('current_order_id');
          setPaymentError('Генерация не удалась — деньги/кредиты вернули вам автоматически. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // Handle canceled/expired payment
        if (data.paymentStatus === 'canceled' || data.paymentStatus === 'expired') {
          clearInterval(interval);
          localStorage.removeItem('current_order_id');
          setPaymentError('Оплата не прошла. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // CRITICAL: paid order with generation error → DO NOT redirect to payment!
        // Show processing screen with retry button instead.
        if (data.generationStatus === 'error' && data.paymentStatus === 'succeeded') {
          clearInterval(interval);
          setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
          // stay on processing screen
          return;
        }

        // Non-paid generation error/canceled
        if (data.generationStatus === 'error' || data.generationStatus === 'canceled') {
          clearInterval(interval);
          localStorage.removeItem('current_order_id');
          setPaymentError('Ошибка генерации. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        // Handle done with results
        if (data.generationStatus === 'done' && data.results?.length > 0) {
          clearInterval(interval);
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
          clearInterval(interval);
          setPaymentError('Оплата не подтверждена. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }
      } catch (e) {
        log.error('Poll error', e);
      }
    }, 3000);

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
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
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-recent-order?customer_key=${encodeURIComponent(customerKey)}`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await response.json();
        if (data.found && data.orderId) {
          log.info('Found recent paid order by customer_key', { orderId: data.orderId, gen: data.generationStatus });
          if (data.generationStatus === 'credits_credited') {
            await handleCreditsCredited(data.orderId, {
              photoUrl: data.originalImage,
              styleId: Array.isArray(data.styleIds) ? data.styleIds[0] : undefined,
            });
            return;
          }
          setRecentOrderPrompt({
            orderId: data.orderId,
            generationStatus: data.generationStatus,
            photosCount: data.photosCount,
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
  // Если баланс > 0 → автоматически переключаем главный экран на Studio.
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
        // Если есть кредиты и юзер на welcome — открываем Studio
        if (info.balance > 0 && screen === 'welcome' && !recentOrderPrompt) {
          setScreen('studio');
        }
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order?order_id=${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await response.json();

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
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order?order_id=${orderId}`,
            {
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          const data = await response.json();

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

  const handleSelectTariff = async (tariff: SelectedTariff) => {
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
      const fileName = `${sessionId}/${Date.now()}.jpg`;
      
      // Convert base64 to blob
      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      let imageStoragePath: string;
      try {
        imageStoragePath = await uploadPhotoDirect(fileName, blob);
      } catch (e: any) {
        throw new Error('Ошибка загрузки фото: ' + (e?.message || 'Failed to fetch'));
      }
      log.info('Image uploaded to storage', { path: fileName });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            tariffId: tariff.id,
            price: tariff.price,
            photosCount: tariff.photos,
            userSessionId: sessionId,
            styleIds: selectedStyles,
            originalImageUrl: imageStoragePath,
            customPrompt: '',
            isFullBody,
            customerKey: getCustomerKey(),
          }),
        }
      );

      const data = await response.json();

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

      if (!response.ok || !data.paymentUrl) {
        if (response.status === 503) {
          throw new Error(data.error || 'Сервис временно перегружен. Попробуйте через несколько минут.');
        }
        throw new Error(data.error || 'Ошибка создания платежа');
      }

      setCurrentOrderId(data.orderId);
      // Save order_id to localStorage before redirect
      localStorage.setItem('current_order_id', data.orderId);
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      log.error('Payment creation failed', e);
      setPaymentError(e.message || 'Ошибка создания платежа. Попробуйте снова.');
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

  const handleRetryGeneration = async () => {
    setRetrying(true);
    setProcessingError(null);
    try {
      const customerKey = getCustomerKey();

      // Resolve orderId: state -> localStorage -> server lookup of recent paid order
      let orderIdToRetry = currentOrderId || localStorage.getItem('current_order_id');

      if (!orderIdToRetry) {
        try {
          const findResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-recent-order?customer_key=${encodeURIComponent(customerKey)}`,
            {
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          const findData = await findResp.json();
          if (findData?.found && findData?.generationStatus === 'credits_credited' && findData?.orderId) {
            await handleCreditsCredited(findData.orderId, {
              photoUrl: findData.originalImage,
              styleId: Array.isArray(findData.styleIds) ? findData.styleIds[0] : undefined,
            });
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

      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order?order_id=${orderIdToRetry}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const statusData = await statusResponse.json();
      if (statusData?.generationStatus === 'credits_credited') {
        await handleCreditsCredited(orderIdToRetry, {
          photoUrl: statusData.originalImage,
          styleId: Array.isArray(statusData.styleIds) ? statusData.styleIds[0] : undefined,
        });
        return;
      }

      // Sync state + storage so polling and further retries use the same id
      if (orderIdToRetry !== currentOrderId) {
        setCurrentOrderId(orderIdToRetry);
      }
      localStorage.setItem('current_order_id', orderIdToRetry);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-generation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ orderId: orderIdToRetry, customerKey }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось перезапустить генерацию');
      }
      if (data.creditsCredited) {
        // Кредиты уже начислены — этот заказ кредитный, пакетная генерация не нужна.
        // Идём в Studio, баланс актуализируем через getBalance.
        localStorage.removeItem('current_order_id');
        setCurrentOrderId(null);
        setProcessingError(null);
        try {
          const info = await studio.getBalance(getCustomerKey());
          setWalletBalance(info.balance);
        } catch (_) { /* ignore */ }
        navigateTo('studio');
      } else if (data.alreadyDone && data.results?.length) {
        setOrderResults(data.results);
        const job: Job = {
          id: 'order_' + orderIdToRetry, userId: getSessionId(), status: 'done',
          styleIds: selectedStyles, isFullBody, originalImage: uploadedImage,
          results: data.results, createdAt: Date.now(),
        };
        setOrderJob(job);
        setCurrentJobId(job.id);
        navigateTo('results');
      } else {
        // Resume polling
        pollOrderStatus(orderIdToRetry);
      }
    } catch (e: any) {
      log.error('Retry generation failed', e);
      setProcessingError('Не удалось перезапустить: ' + (e?.message || ''));
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
    <div className="max-w-md mx-auto relative min-h-screen bg-background shadow-2xl">
      <main className="relative min-h-screen">
        {screen === 'studio' && (
          <StudioScreen
            customerKey={getCustomerKey()}
            initialBalance={walletBalance}
            onBalanceChange={setWalletBalance}
            onBuyMore={() => navigateTo('tariff')}
            onGeneratingChange={(g) => { studioGeneratingRef.current = g; }}
            prefillPhotoUrl={prefilledStudio?.photoUrl}
            prefillStyleId={prefilledStudio?.styleId}
          />
        )}

        {screen === 'welcome' && (
          <WelcomeScreen onStart={() => navigateTo('goal')} />
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
            styles={STYLES}
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

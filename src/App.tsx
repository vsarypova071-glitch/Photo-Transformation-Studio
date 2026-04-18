import { useState, useEffect, useCallback } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory, Job } from './types';
import { createLogger } from './utils/logger';
import { supabase } from './integrations/supabase/client';

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
    price?: number;
    paymentMethod?: 'rub' | 'credits';
  } | null>(null);
  // 🟢 STAGE WALLET 1.4 — баланс кошелька (загружается при старте по customer_key)
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoaded, setWalletLoaded] = useState<boolean>(false);

  const navigateTo = (newScreen: Screen) => {
    log.info('Navigate', { from: screen, to: newScreen });
    setScreen(newScreen);
    window.scrollTo(0, 0);
  };

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

        // If still pending after 60 polls (3 min), something is wrong
        if (data.paymentStatus === 'pending' && pollCount > 60) {
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
  }, [selectedStyles, isFullBody, uploadedImage]);

  // Restore order from localStorage on mount
  useEffect(() => {
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('order_id')) return;

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
          setRecentOrderPrompt({
            orderId: data.orderId,
            generationStatus: data.generationStatus,
            photosCount: data.photosCount,
            results: data.results || [],
            price: data.price,
            paymentMethod: data.paymentMethod,
          });
        }
      } catch (e) {
        log.warn('find-recent-order failed', e);
      }
    })();
  }, []);

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
    setCurrentOrderId(orderId);
    localStorage.setItem('current_order_id', orderId);

    if (generationStatus === 'done' && results.length > 0) {
      const job: Job = {
        id: 'order_' + orderId,
        userId: getSessionId(),
        status: 'done',
        styleIds: [],
        isFullBody: false,
        originalImage: '',
        results,
        createdAt: Date.now(),
        // STAGE 3.1
        expectedCount: recentOrderPrompt.photosCount,
        priceRub: recentOrderPrompt.price,
        paymentMethod: recentOrderPrompt.paymentMethod,
      };
      setOrderJob(job);
      setCurrentJobId(job.id);
      setOrderResults(results);
      setScreen('results');
    } else if (generationStatus === 'error') {
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

      if (data.generationStatus === 'done' && data.results?.length > 0) {
        const job: Job = {
          id: 'order_' + orderId,
          userId: getSessionId(),
          status: 'done',
          styleIds: [],
          isFullBody: false,
          originalImage: '',
          results: data.results,
          createdAt: Date.now(),
          // STAGE 3.1
          expectedCount: data.photosCount,
          priceRub: data.price,
          paymentMethod: data.paymentMethod,
        };
        setOrderJob(job);
        setCurrentJobId(job.id);
        setOrderResults(data.results);
        setScreen('results');
        return;
      }

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

          // Already done — show results directly
          if (data.generationStatus === 'done' && data.results?.length > 0) {
            const job: Job = {
              id: 'order_' + orderId,
              userId: getSessionId(),
              status: 'done',
              styleIds: [],
              isFullBody: false,
              originalImage: '',
              results: data.results,
              createdAt: Date.now(),
              // STAGE 3.1
              expectedCount: data.photosCount,
              priceRub: data.price,
              paymentMethod: data.paymentMethod,
            };
            setOrderJob(job);
            setCurrentJobId(job.id);
            setOrderResults(data.results);
            setScreen('results');
            return;
          }

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

          // Still processing or pending — show processing and poll
          setScreen('processing');
          pollOrderStatus(orderId);
        } catch (e) {
          log.error('Initial order check failed', e);
          setScreen('processing');
          pollOrderStatus(orderId);
        }
      })();
    }
  }, [pollOrderStatus]);

  const handlePayWithCredits = async (tariff: SelectedTariff) => {
    setSelectedTariff(tariff);
    setPaymentError(null);
    log.info('Paying with credits', { tariff: tariff.name, photos: tariff.photos });

    try {
      const sessionId = getSessionId();
      const fileName = `${sessionId}/${Date.now()}.jpg`;

      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        throw new Error('Ошибка загрузки фото: ' + uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(fileName);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay-with-credits`,
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
            originalImageUrl: urlData.publicUrl,
            customPrompt: '',
            isFullBody,
            customerKey: getCustomerKey(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error(`Недостаточно кредитов. Баланс: ${data.balance}, нужно: ${data.required}`);
        }
        throw new Error(data.error || 'Ошибка оплаты кредитами');
      }

      setCurrentOrderId(data.orderId);
      localStorage.setItem('current_order_id', data.orderId);
      navigateTo('processing');
      pollOrderStatus(data.orderId);
    } catch (e: any) {
      log.error('Credit payment failed', e);
      setPaymentError(e.message || 'Ошибка оплаты кредитами');
    }
  };

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

      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        throw new Error('Ошибка загрузки фото: ' + uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(fileName);

      const imageStoragePath = urlData.publicUrl;
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
        setCurrentOrderId(data.orderId);
        localStorage.setItem('current_order_id', data.orderId);
        setPaymentError(null);
        // STAGE 1.2 — release lock since we're navigating away
        setIsCreatingPayment(false);

        // Already finished — go straight to results
        if (data.generationStatus === 'done' && data.results?.length > 0) {
          setOrderResults(data.results);
          const job: Job = {
            id: 'order_' + data.orderId,
            userId: getSessionId(),
            status: 'done',
            styleIds: selectedStyles,
            isFullBody,
            originalImage: uploadedImage,
            results: data.results,
            createdAt: Date.now(),
          };
          setOrderJob(job);
          setCurrentJobId(job.id);
          navigateTo('results');
          return;
        }

        // Failed generation — show retry UI on processing screen
        if (data.generationStatus === 'error') {
          setProcessingError('Генерация не завершилась. Ваша оплата сохранена — нажмите «Попробовать снова», повторная оплата не нужна.');
          navigateTo('processing');
          return;
        }

        // Still running/waiting — show processing and poll
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
    if (!currentOrderId) return;
    setRetrying(true);
    setProcessingError(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-generation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ orderId: currentOrderId, customerKey: getCustomerKey() }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось перезапустить генерацию');
      }
      if (data.alreadyDone && data.results?.length) {
        setOrderResults(data.results);
        const job: Job = {
          id: 'order_' + currentOrderId, userId: getSessionId(), status: 'done',
          styleIds: selectedStyles, isFullBody, originalImage: uploadedImage,
          results: data.results, createdAt: Date.now(),
        };
        setOrderJob(job);
        setCurrentJobId(job.id);
        navigateTo('results');
      } else {
        // Resume polling
        pollOrderStatus(currentOrderId);
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
            onTestGenerate={async () => {
              if (selectedStyles.length === 0) {
                alert('Выберите хотя бы один стиль');
                return;
              }
              navigateTo('processing');
              try {
                const stylePrompts = selectedStyles
                  .map(id => STYLES.find(s => s.id === id)?.prompt)
                  .filter(Boolean)
                  .join('\n');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000);

                const response = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-photo`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    },
                    body: JSON.stringify({
                      imageBase64: uploadedImage,
                      stylePrompt: stylePrompts || 'Luxury fashion portrait photography',
                      isPremium: false,
                      customPrompt: '',
                    }),
                    signal: controller.signal,
                  }
                );
                clearTimeout(timeoutId);

                const data = await response.json();
                if (!response.ok || !data?.imageUrl) {
                  throw new Error(data?.error || 'Ошибка генерации');
                }

                const testJob: Job = {
                  id: 'test_' + Date.now(),
                  userId: 'test',
                  status: 'done',
                  styleIds: selectedStyles,
                  isFullBody,
                  originalImage: uploadedImage,
                  results: [data.imageUrl],
                  createdAt: Date.now(),
                };
                setOrderJob(testJob);
                setCurrentJobId(testJob.id);
                navigateTo('results');
              } catch (e: any) {
                log.error('Test generation failed', e);
                alert('Ошибка: ' + (e?.message || 'Неизвестная ошибка'));
                navigateTo('styles');
              }
            }}
          />
        )}

        {screen === 'tariff' && (
          <TariffScreen
            onSelectTariff={handleSelectTariff}
            onPayWithCredits={handlePayWithCredits}
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

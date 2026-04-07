import { useState, useEffect, useCallback } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory } from './types';
import { createLogger } from './utils/logger';

import WelcomeScreen from './components/screens/WelcomeScreen';
import GoalScreen from './components/screens/GoalScreen';
import UploadScreen from './components/screens/UploadScreen';
import StylesScreen from './components/screens/StylesScreen';
import TariffScreen from './components/screens/TariffScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';

const log = createLogger('App');

export type Screen = 'welcome' | 'goal' | 'upload' | 'styles' | 'tariff' | 'processing' | 'results';

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
  const [orderResults, setOrderResults] = useState<string[]>([]);

  const navigateTo = (newScreen: Screen) => {
    log.info('Navigate', { from: screen, to: newScreen });
    setScreen(newScreen);
    window.scrollTo(0, 0);
  };

  // Poll order status after payment
  const pollOrderStatus = useCallback((orderId: string) => {
    log.info('Polling order', { orderId });
    const interval = setInterval(async () => {
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

        if (data.paymentStatus === 'canceled') {
          clearInterval(interval);
          setPaymentError('Оплата не подтверждена. Попробуйте снова.');
          navigateTo('tariff');
          return;
        }

        if (data.generationStatus === 'done' && data.results?.length > 0) {
          clearInterval(interval);
          setOrderResults(data.results);

          // Save as job for ResultsScreen compatibility
          const jobId = 'order_' + orderId;
          const job = {
            id: jobId,
            userId: getSessionId(),
            status: 'done' as const,
            styleIds: selectedStyles,
            isFullBody,
            originalImage: uploadedImage,
            results: data.results,
            createdAt: Date.now(),
          };
          sessionStorage.setItem('ai_studio_jobs_data', JSON.stringify([job]));
          setCurrentJobId(jobId);
          navigateTo('results');
          return;
        }

        if (data.generationStatus === 'error') {
          clearInterval(interval);
          setPaymentError('Ошибка генерации. Попробуйте снова.');
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

  // Check URL for returning from payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    if (orderId) {
      setCurrentOrderId(orderId);
      setScreen('processing');
      pollOrderStatus(orderId);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [pollOrderStatus]);

  const handleSelectTariff = async (tariff: SelectedTariff) => {
    setSelectedTariff(tariff);
    setPaymentError(null);
    log.info('Creating payment', { tariff: tariff.name, price: tariff.price });

    try {
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
            userSessionId: getSessionId(),
            styleIds: selectedStyles,
            originalImage: uploadedImage,
            customPrompt: '',
            isFullBody,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.paymentUrl) {
        if (response.status === 503) {
          throw new Error('Сервис временно перегружен. Попробуйте через несколько минут.');
        }
        throw new Error(data.error || 'Ошибка создания платежа');
      }

      setCurrentOrderId(data.orderId);
      // Redirect to YooKassa payment page
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      log.error('Payment creation failed', e);
      setPaymentError(e.message || 'Ошибка создания платежа. Попробуйте снова.');
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
    const job = backend.getJobs().find(j => j.id === currentJobId);
    if (job && job.results[0]) {
      navigateTo('processing');
      try {
        const newJob = await backend.refineJob(job.results[0], prompt);
        setCurrentJobId(newJob.id);
        pollJob(newJob.id);
      } catch (e: any) {
        log.error('Refine failed', e);
        alert("Ошибка правки. Попробуйте ещё раз.");
        navigateTo('results');
      }
    }
  };

  const handleFullBody = async () => {
    const job = backend.getJobs().find(j => j.id === currentJobId);
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
      pollJob(newJob.id);
    } catch (e: any) {
      log.error('Full body failed', e);
      alert("Ошибка генерации во весь рост. Попробуйте ещё раз.");
      navigateTo('results');
    }
  };

  const handleNewPhoto = () => {
    setUploadedImage('');
    setSelectedStyles([]);
    setSelectedTariff(null);
    setCurrentOrderId(null);
    setOrderResults([]);
    navigateTo('upload');
  };

  const currentJob = backend.getJobs().find(j => j.id === currentJobId);

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

                const testJobId = 'test_' + Date.now();
                const testJob = {
                  id: testJobId,
                  userId: 'test',
                  status: 'done' as const,
                  styleIds: selectedStyles,
                  isFullBody,
                  originalImage: uploadedImage,
                  results: [data.imageUrl],
                  createdAt: Date.now(),
                };
                sessionStorage.setItem('ai_studio_jobs_data', JSON.stringify([testJob]));
                setCurrentJobId(testJobId);
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
            onBack={() => navigateTo('styles')}
            paymentError={paymentError}
          />
        )}
        
        {screen === 'processing' && <ProcessingScreen />}
        
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

      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-20%] w-[120%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0" />
    </div>
  );
}

export default App;

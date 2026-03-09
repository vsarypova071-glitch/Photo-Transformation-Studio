import { useState } from 'react';
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

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [uploadedImage, setUploadedImage] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<StyleCategory>('realistic');
  const [intensity, setIntensity] = useState(70);
  const [isFullBody, setIsFullBody] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<SelectedTariff | null>(null);

  const navigateTo = (newScreen: Screen) => {
    log.info('Navigate', { from: screen, to: newScreen });
    setScreen(newScreen);
    window.scrollTo(0, 0);
  };

  const handleSelectTariff = (tariff: SelectedTariff) => {
    setSelectedTariff(tariff);
    log.info('Tariff selected', { tariff: tariff.name, price: tariff.price });
    // TODO: Здесь будет интеграция с ЮKassa
    // После успешной оплаты -> navigateTo('processing')
    alert(`Тариф "${tariff.name}" выбран!\n\nИнтеграция с ЮKassa в разработке.\nПосле подключения платежей здесь откроется форма оплаты.`);
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
        if (e?.message === 'INSUFFICIENT_CREDITS') {
          alert("Недостаточно кредитов для магической правки.");
        } else if (e?.message === 'NOT_AUTHENTICATED') {
          alert("Необходимо войти в аккаунт.");
        } else {
          alert("Ошибка правки. Попробуйте ещё раз.");
        }
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
      if (e?.message === 'INSUFFICIENT_CREDITS') {
        alert("Недостаточно кредитов. Пополните баланс для генерации во весь рост.");
      } else if (e?.message === 'NOT_AUTHENTICATED') {
        alert("Необходимо войти в аккаунт для использования этой функции.");
      } else {
        alert("Ошибка генерации во весь рост. Попробуйте ещё раз.");
      }
      navigateTo('results');
    }
  };

  const handleNewPhoto = () => {
    setUploadedImage('');
    setSelectedStyles([]);
    setSelectedTariff(null);
    navigateTo('upload');
  };

  const currentJob = backend.getJobs().find(j => j.id === currentJobId);

  return (
    <div className="max-w-md mx-auto relative min-h-screen bg-background shadow-2xl">
      <main className="relative min-h-screen">
        {screen === 'welcome' && (
          <WelcomeScreen onStart={() => navigateTo('upload')} />
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
                // Прямой вызов edge function с увеличенным таймаутом (300 сек)
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

                // Сохраняем результат как фейковый job
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
                // Сохраняем в sessionStorage напрямую
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

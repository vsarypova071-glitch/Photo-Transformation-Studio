import { useState } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory } from './types';
import { createLogger } from './utils/logger';
import WelcomeScreen from './components/screens/WelcomeScreen';
import UploadScreen from './components/screens/UploadScreen';
import StylesScreen from './components/screens/StylesScreen';
import TariffScreen from './components/screens/TariffScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';

const log = createLogger('App');

export type Screen = 'welcome' | 'upload' | 'styles' | 'tariff' | 'processing' | 'results';

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
      } catch (e) {
        alert("Ошибка.");
        navigateTo('results');
      }
    }
  };

  const handleFullBody = async () => {
    const job = backend.getJobs().find(j => j.id === currentJobId);
    if (job && job.results[0]) {
      navigateTo('processing');
      try {
        const newJob = await backend.refineJob(
          job.results[0],
          "Extend this specific portrait to a full-length standing shot, showing the person from head to toe including matching high-end shoes, maintaining exactly the same style and face."
        );
        setCurrentJobId(newJob.id);
        pollJob(newJob.id);
      } catch (e) {
        alert("Ошибка.");
        navigateTo('results');
      }
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
            onBack={() => navigateTo('welcome')}
          />
        )}
        
        {screen === 'styles' && (
          <StylesScreen
            styles={STYLES}
            selectedStyles={selectedStyles}
            activeCategory={activeCategory}
            intensity={intensity}
            isFullBody={isFullBody}
            onSelectStyle={(id) => setSelectedStyles([id])}
            onCategoryChange={setActiveCategory}
            onIntensityChange={setIntensity}
            onFullBodyToggle={() => setIsFullBody(!isFullBody)}
            onBack={() => navigateTo('upload')}
            onGenerate={() => navigateTo('tariff')}
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

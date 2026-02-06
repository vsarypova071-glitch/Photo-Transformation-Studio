import { useState, useEffect } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory, User, PlanType } from './types';
import { createLogger } from './utils/logger';
import WelcomeScreen from './components/screens/WelcomeScreen';
import UploadScreen from './components/screens/UploadScreen';
import StylesScreen from './components/screens/StylesScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ProfileOverlay from './components/ProfileOverlay';
import Header from './components/Header';

const log = createLogger('App');

export type Screen = 'welcome' | 'upload' | 'styles' | 'processing' | 'results';

const defaultUser: User = {
  id: '',
  plan: PlanType.FREE,
  remainingCredits: 0,
  allowedStylesCount: 0,
  history: []
};

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [user, setUser] = useState<User>(defaultUser);
  const [uploadedImage, setUploadedImage] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<StyleCategory>('realistic');
  const [intensity, setIntensity] = useState(70);
  const [isFullBody, setIsFullBody] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initUser = async () => {
      try {
        const userData = await backend.getUser();
        setUser(userData);
        log.info('App initialized', { screen, userId: userData.id });
      } catch (error) {
        log.error('Failed to initialize user', error);
      } finally {
        setIsLoading(false);
      }
    };
    initUser();
  }, []);

  const syncUser = async () => {
    try {
      const updated = await backend.getUser();
      setUser(updated);
      log.debug('User synced', { credits: updated.remainingCredits });
    } catch (error) {
      log.error('Failed to sync user', error);
    }
  };

  const navigateTo = (newScreen: Screen) => {
    log.info('Navigate', { from: screen, to: newScreen });
    setScreen(newScreen);
    window.scrollTo(0, 0);
  };

  const handleStartJob = async (customPrompt: string) => {
    if (user.remainingCredits <= 0) {
      alert("Недостаточно кредитов. Активируйте промокод в профиле.");
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
          await syncUser();
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
    navigateTo('upload');
  };

  const handleActivateVip = async () => {
    const result = await backend.activateCode('CODE-VIP-999');
    if (result.success) {
      await syncUser();
    }
    alert(result.message);
  };

  const currentJob = backend.getJobs().find(j => j.id === currentJobId);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto relative min-h-screen bg-background shadow-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto relative min-h-screen bg-background shadow-2xl">
      <Header 
        user={user} 
        visible={screen !== 'welcome'} 
        onProfileClick={() => setShowProfile(true)} 
      />

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
            intensity={intensity}
            isFullBody={isFullBody}
            onSelectStyle={(id) => setSelectedStyles([id])}
            onCategoryChange={setActiveCategory}
            onIntensityChange={setIntensity}
            onFullBodyToggle={() => setIsFullBody(!isFullBody)}
            onBack={() => navigateTo('upload')}
            onGenerate={handleStartJob}
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

      {showProfile && (
        <ProfileOverlay
          user={user}
          onClose={() => setShowProfile(false)}
          onActivateVip={handleActivateVip}
        />
      )}

      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-20%] w-[120%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0" />
    </div>
  );
}

export default App;
import { useState, useEffect } from 'react';
import { backend } from './services/backend';
import { STYLES } from './lib/constants';
import { StyleCategory, User, PlanType } from './types';
import { createLogger } from './utils/logger';
import { supabase } from '@/integrations/supabase/client';
import WelcomeScreen from './components/screens/WelcomeScreen';
import UploadScreen from './components/screens/UploadScreen';
import StylesScreen from './components/screens/StylesScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ProfileOverlay from './components/ProfileOverlay';
import Header from './components/Header';
import AuthPage from './pages/AuthPage';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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

  // Check authentication state on mount
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      log.info('Auth state changed', { event, hasSession: !!session });
      setIsAuthenticated(!!session);
      
      if (!session) {
        setUser(defaultUser);
        setIsLoading(false);
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initUser();
    }
  }, [isAuthenticated]);

  const initUser = async () => {
    try {
      setIsLoading(true);
      const userData = await backend.getUser();
      setUser(userData);
      log.info('App initialized', { screen, userId: userData.id });
    } catch (error) {
      log.error('Failed to initialize user', error);
      // If not authenticated error, sign out
      if (error instanceof Error && error.message === 'NOT_AUTHENTICATED') {
        await supabase.auth.signOut();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncUser = async () => {
    try {
      const updated = await backend.getUser();
      setUser(updated);
      log.debug('User synced', { credits: updated.remainingCredits });
    } catch (error) {
      log.error('Failed to sync user', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(defaultUser);
    setScreen('welcome');
    setShowProfile(false);
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

  const handleActivateCode = async (code: string) => {
    const result = await backend.activateCode(code);
    if (result.success) {
      await syncUser();
    }
    return result;
  };

  const currentJob = backend.getJobs().find(j => j.id === currentJobId);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="max-w-md mx-auto relative min-h-screen bg-background shadow-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  // Show loading while fetching user data
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
          onActivateCode={handleActivateCode}
          onSignOut={handleSignOut}
        />
      )}

      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-20%] w-[120%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0" />
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';

interface ProcessingScreenProps {
  errorMessage?: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  onAbandon?: () => void;
}

export default function ProcessingScreen({ errorMessage, retrying, onRetry, onAbandon }: ProcessingScreenProps) {
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('Анализ пропорций');

  useEffect(() => {
    if (errorMessage) return;
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s > 5) setStatus('Масштабирование');
        if (s > 12) setStatus('Финальный рендеринг');
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [errorMessage]);

  if (errorMessage) {
    return (
      <section className="min-h-screen flex items-center justify-center px-6 text-center flex-col">
        <div className="w-20 h-20 mb-6 rounded-full bg-amber-500/20 flex items-center justify-center text-4xl">
          ⚠️
        </div>
        <h2 className="text-2xl font-bold mb-3 text-foreground">
          Генерация не завершилась
        </h2>
        <p className="text-muted-foreground text-sm mb-2 max-w-sm">
          {errorMessage}
        </p>
        <p className="text-emerald-400 text-sm font-semibold mb-8">
          ✅ Ваша оплата сохранена. Повторно платить не нужно.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={onRetry}
            disabled={retrying}
            className="w-full py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-all">
            {retrying ? 'Перезапуск...' : '🔄 Попробовать снова'}
          </button>
          <button
            onClick={onAbandon}
            disabled={retrying}
            className="w-full py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
            Вернуться к выбору тарифа
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen flex items-center justify-center px-12 text-center flex-col">
      <div className="relative w-44 h-44 mb-16">
        <div className="absolute inset-0 rounded-full border-4 border-secondary" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center font-bold text-4xl text-primary">
          {seconds}s
        </div>
      </div>
      <p className="text-2xl mb-4">Оплата прошла ✅</p>
      <h2 className="text-4xl font-black mb-6 uppercase tracking-tight leading-tight text-foreground">
        Мы уже создаём <br/> ваши фото
      </h2>
      <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest animate-pulse">
        {status}
      </p>
    </section>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReviewsSection from '../ReviewsSection';
import demoBusinessImg from '@/assets/demo/demo-business.jpg';
import demoLuxuryImg from '@/assets/demo/demo-luxury.jpg';
import demoMinimalImg from '@/assets/demo/demo-minimal.jpg';
import demoGoldenImg from '@/assets/demo/demo-golden.jpg';
import demoElegantImg from '@/assets/demo/demo-elegant.jpg';

interface WelcomeScreenProps {
  onStart: () => void;
}

const SLIDES = [
  {
    img: demoBusinessImg,
    title: 'Business Portrait',
    sub: 'Профессиональный деловой образ',
    accent: 'from-slate-900/80 via-slate-800/40',
  },
  {
    img: demoLuxuryImg,
    title: 'Luxury Editorial',
    sub: 'Фотосессия как в модном журнале',
    accent: 'from-neutral-900/80 via-neutral-800/40',
  },
  {
    img: demoMinimalImg,
    title: 'Minimal Portrait',
    sub: 'Минималистичный студийный портрет',
    accent: 'from-zinc-900/80 via-zinc-700/40',
  },
  {
    img: demoGoldenImg,
    title: 'Golden Hour',
    sub: 'Тёплый портрет на закате',
    accent: 'from-amber-900/80 via-amber-800/30',
  },
  {
    img: demoElegantImg,
    title: 'Elegant Lifestyle',
    sub: 'Элегантный современный образ',
    accent: 'from-stone-900/80 via-stone-800/40',
  },
];

const INTERVAL_MS = 3500;

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [active, setActive] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch/swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goTo = useCallback((idx: number, dir: 'left' | 'right') => {
    if (isAnimating) return;
    setAnimDir(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setActive(idx);
      setIsAnimating(false);
    }, 350);
  }, [isAnimating]);

  const next = useCallback(() => {
    const idx = (active + 1) % SLIDES.length;
    goTo(idx, 'right');
  }, [active, goTo]);

  const prev = useCallback(() => {
    const idx = (active - 1 + SLIDES.length) % SLIDES.length;
    goTo(idx, 'left');
  }, [active, goTo]);

  // Auto-advance
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % SLIDES.length;
        setAnimDir('right');
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 350);
        return next;
      });
    }, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Reset timer on manual nav
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(p => {
        const n = (p + 1) % SLIDES.length;
        setAnimDir('right');
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 350);
        return n;
      });
    }, INTERVAL_MS);
  }, []);

  const handleDotClick = (i: number) => {
    if (i === active) return;
    goTo(i, i > active ? 'right' : 'left');
    resetTimer();
  };

  const handlePrev = () => { prev(); resetTimer(); };
  const handleNext = () => { next(); resetTimer(); };

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0));
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const slide = SLIDES[active];

  return (
    <section className="min-h-screen flex flex-col items-center px-5 py-10 rounded-2xl">

      {/* Top badge */}
      <div className="mb-6 text-center">
        <span className="text-[9px] uppercase tracking-[0.4em] text-white/60 font-semibold bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-1.5 rounded-full">
          AI Photo Studio
        </span>
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <span className="block text-[11px] uppercase tracking-[0.3em] text-white/50 mb-2 font-medium">
          AI Фотостудия
        </span>
        <h1 className="leading-tight">
          <span className="block text-[28px] font-semibold text-white leading-tight">
            AI фотосессия
          </span>
          <span className="block text-[22px] font-light bg-gradient-to-r from-blue-300 via-white to-blue-200 bg-clip-text text-transparent">
            за 1 минуту
          </span>
        </h1>
        <p className="text-[11px] font-light leading-relaxed text-white/70 mt-3 max-w-xs mx-auto">
          Загрузите своё селфи — получите{' '}
          <span className="text-white font-medium">15 профессиональных фотографий</span>{' '}
          в разных премиальных стилях
        </p>
      </div>

      {/* ── Demo Carousel ── */}
      <div
        className="relative w-full max-w-sm mb-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Card */}
        <div
          className="relative w-full aspect-[3/4] rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]"
          style={{
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating
              ? `translateX(${animDir === 'right' ? '-24px' : '24px'}) scale(0.97)`
              : 'translateX(0) scale(1)',
          }}
        >
          <img
            key={active}
            src={slide.img}
            alt={slide.title}
            className="object-cover w-full h-full scale-105"
            draggable={false}
          />

          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t ${slide.accent} to-transparent`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* "Пример AI-результата" badge */}
          <div className="absolute top-4 right-4">
            <span className="text-[8px] uppercase tracking-[0.3em] text-white/80 font-semibold bg-black/40 backdrop-blur-sm border border-white/15 px-2.5 py-1 rounded-full">
              Пример AI
            </span>
          </div>

          {/* Slide caption */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-medium mb-1">
              {slide.title}
            </p>
            <p className="text-[15px] font-semibold text-white leading-snug">
              {slide.sub}
            </p>
          </div>

          {/* Arrow nav — prev */}
          <button
            onClick={handlePrev}
            aria-label="Предыдущий"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-all active:scale-90"
          >
            ‹
          </button>
          {/* Arrow nav — next */}
          <button
            onClick={handleNext}
            aria-label="Следующий"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-all active:scale-90"
          >
            ›
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              aria-label={`Слайд ${i + 1}`}
              className="transition-all duration-300"
              style={{
                width: i === active ? '20px' : '6px',
                height: '6px',
                borderRadius: '999px',
                background: i === active
                  ? 'hsl(217.2 91.2% 59.8%)'
                  : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex gap-3 mb-7 text-[10px]">
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
          <span className="tracking-wide text-slate-50">Реалистичные фото</span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"></span>
          <span className="tracking-wide text-slate-50">12 стилей</span>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onStart}
        className="btn-shimmer w-full max-w-sm py-5 px-8 rounded-full font-semibold text-sm text-white uppercase tracking-widest transition-all active:scale-95"
      >
        ✦ Создать AI-фотосессию
      </button>

      {/* Speed badge */}
      <p className="text-[10px] mt-3 text-white/50 flex items-center gap-1.5">
        <span className="text-yellow-400">⚡</span>
        Генерация занимает около 30–60 секунд
      </p>

      {/* How it works */}
      <div className="w-full max-w-sm mt-9 mb-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 text-center mb-6">Как это работает</p>
        <div className="flex items-start justify-between gap-2">
          {[
            { num: '1', label: 'Загрузите селфи', sub: 'Одно фото достаточно', icon: '📸' },
            { num: '2', label: 'Выберите стиль', sub: '12 премиальных стилей', icon: '🎭' },
            { num: '3', label: 'Получите 15 фото', sub: 'Как после фотосессии', icon: '🖼' },
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div
                className="flex flex-col items-center flex-1 text-center"
                style={{ animation: `fade-in 0.5s ease-out ${i * 150}ms both` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl mb-3 shadow-[0_4px_20px_rgba(255,255,255,0.05)]">
                  {step.icon}
                </div>
                <span className="text-[9px] font-semibold text-primary/70 uppercase tracking-widest block mb-1">Шаг {step.num}</span>
                <span className="text-[11px] text-white/90 leading-tight font-semibold mb-1">{step.label}</span>
                <span className="text-[9px] text-white/40 leading-tight">{step.sub}</span>
              </div>
              {i < 2 && (
                <div className="flex-shrink-0 mt-6 text-white/20 text-base">›</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Privacy notice */}
      <p className="text-[9px] text-white/30 text-center mt-8 leading-relaxed max-w-xs">
        🔒 Ваше фото используется только для генерации<br />
        и автоматически удаляется после обработки
      </p>

      {/* Reviews Section */}
      <ReviewsSection />
    </section>
  );
}

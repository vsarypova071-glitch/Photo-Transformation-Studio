import React, { useState } from 'react';
import ReviewsSection from '../ReviewsSection';
import heroCover from '@/assets/hero-cover.png';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [beforeAfterPos, setBeforeAfterPos] = useState(50);

  return (
    <section className="min-h-screen flex flex-col items-center px-5 py-10 rounded-2xl">

      {/* Hero Card */}
      <div className="relative w-full max-w-sm aspect-[3/4] mb-8 rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
        <img src={heroCover} className="object-cover w-full h-full scale-105" alt="AI Фотосессия" />
        {/* Multi-layer gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-900/20" />

        {/* Top badge */}
        <div className="absolute top-5 left-5">
          <span className="text-[9px] uppercase tracking-[0.4em] text-white/70 font-semibold bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 rounded-full">
            AI Photo Studio
          </span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-7 text-left">
          <h1 className="font-extralight leading-[1.15] mb-3 tracking-wide">
            <span className="block text-[11px] uppercase tracking-[0.3em] text-white/60 mb-2 font-medium">
              AI Фотостудия
            </span>
            <span className="block text-[28px] font-semibold text-white leading-tight">
              AI фотосессия
            </span>
            <span className="block text-[22px] font-light bg-gradient-to-r from-blue-300 via-white to-blue-200 bg-clip-text text-transparent">
              за 1 минуту
            </span>
          </h1>

          <div className="w-10 h-[1px] bg-gradient-to-r from-white/40 to-transparent my-4" />

          <p className="text-[11px] font-light leading-relaxed tracking-wide text-white/80">
            Загрузите своё селфи — получите<br />
            <span className="text-white font-medium">15 профессиональных фотографий</span><br />
            в разных премиальных стилях
          </p>
        </div>

        {/* Subtle top shine */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent" />
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 text-center mb-5">Как это работает</p>
        <div className="flex items-start justify-between gap-2">
          {[
            { num: '1', label: 'Загрузите\nселфи', icon: '🤳' },
            { num: '2', label: 'Выберите\nстиль', icon: '🎨' },
            { num: '3', label: 'Получите\n15 фото', icon: '✨' },
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center flex-1 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl mb-2.5">
                  {step.icon}
                </div>
                <span className="text-[9px] font-semibold text-white/40 uppercase tracking-widest block mb-1">Шаг {step.num}</span>
                <span className="text-[11px] text-white/80 leading-tight whitespace-pre-line font-medium">{step.label}</span>
              </div>
              {i < 2 && (
                <div className="flex-shrink-0 mt-5 text-white/20 text-sm">›</div>
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

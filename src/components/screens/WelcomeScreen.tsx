import React from 'react';
import ReviewsSection from '../ReviewsSection';
import heroCover from '@/assets/hero-cover.jpeg';
interface WelcomeScreenProps {
  onStart: () => void;
}
export default function WelcomeScreen({
  onStart
}: WelcomeScreenProps) {
  return <section className="min-h-screen flex flex-col items-center px-5 py-10">
      {/* Hero Card */}
      <div className="relative w-full max-w-sm aspect-[3/4] mb-10 rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
        <img src={heroCover} className="object-cover w-full h-full scale-105" alt="Фотосессия" />
        {/* Multi-layer gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-900/20" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-7 text-left">
          <p className="text-[9px] uppercase tracking-[0.4em] font-light mb-4 text-slate-100">
            AI Photo Studio
          </p>
          
          <h1 className="font-extralight leading-[1.2] mb-2 tracking-wide text-slate-50 text-3xl">
            Ваш идеальный<br />
            <span className="font-medium bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-slate-50 bg-slate-50 text-2xl">
              образ уже здесь
            </span>
          </h1>
          
          <div className="w-10 h-[1px] bg-gradient-to-r from-white/40 to-transparent my-4" />
          
          <p className="text-[11px] font-light leading-relaxed tracking-wider text-slate-50 font-sans">
            Фотосессия мечты за 2 минуты.<br />
            Без фотографа. Без студии. Просто магия.
          </p>
        </div>

        {/* Subtle top shine */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent" />
      </div>

      {/* Trust badges */}
      <div className="flex gap-3 mb-8 text-[10px]">
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
          <span className="tracking-wide text-slate-50">Реалистичные фото</span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"></span>
          <span className="tracking-wide text-slate-50">12 стилей</span>
        </div>
      </div>

      {/* CTA Button - shimmer */}
      <button onClick={onStart} className="btn-shimmer w-full max-w-sm py-5 px-8 rounded-full font-semibold text-sm text-white uppercase tracking-widest transition-all active:scale-95">
        ✦ Создать свой образ
      </button>
      
      <p className="text-white/25 text-[10px] mt-5 tracking-widest uppercase">
        Загрузите фото · Выберите стиль · Восхищайтесь
      </p>

      {/* Reviews Section */}
      <ReviewsSection />
    </section>;
}
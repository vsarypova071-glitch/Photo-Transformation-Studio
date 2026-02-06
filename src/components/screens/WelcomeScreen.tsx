import React from 'react';
import ReviewsSection from '../ReviewsSection';
import heroCover from '@/assets/hero-cover.jpeg';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 text-center flex-col py-12">
      {/* Hero Image */}
      <div className="relative w-full max-w-sm aspect-[3/4] mb-8 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <img 
          src={heroCover} 
          className="object-cover w-full h-full" 
          alt="Фотосессия"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-left">
          <p className="text-white/60 text-[10px] uppercase tracking-[0.3em] font-light mb-3">
            AI Photo Studio
          </p>
          
          <h1 className="text-3xl font-extralight leading-snug mb-3 text-white tracking-wide">
            Премиум<br/>
            <span className="font-normal italic text-white/90">Фотосессия</span>
          </h1>
          
          <div className="w-8 h-[1px] bg-white/30 mb-4" />
          
          <p className="text-white/50 text-xs font-light leading-relaxed tracking-wide">
            12 эксклюзивных стилей · AI технологии
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex gap-4 mb-8 text-xs">
        <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-muted-foreground">Реалистичные фото</span>
        </div>
        <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span className="text-muted-foreground">12 стилей</span>
        </div>
      </div>

      {/* CTA Button */}
      <button 
        onClick={onStart} 
        className="btn-primary w-full max-w-sm text-base"
      >
        🚀 Начать фотосессию
      </button>
      
      <p className="text-muted-foreground text-xs mt-4">
        Загрузите фото → Выберите стиль → Получите результат
      </p>

      {/* Reviews Section */}
      <ReviewsSection />
    </section>
  );
}

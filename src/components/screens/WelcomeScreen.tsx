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
        <div className="absolute bottom-8 left-6 right-6 text-left">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-black text-primary-foreground text-sm shadow-lg">
              AI
            </div>
            <span className="text-primary font-black text-xs uppercase tracking-widest">Photo Studio</span>
          </div>
          
          <h1 className="text-4xl font-black leading-tight mb-4 text-white">
            Премиум<br/>
            <span className="gradient-text">Фотосессия</span>
          </h1>
          
          <p className="text-slate-300 text-sm leading-relaxed">
            Создайте потрясающие фото для Instagram с помощью искусственного интеллекта. 
            12 эксклюзивных стилей.
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

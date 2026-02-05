import React from 'react';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 text-center flex-col py-12">
      {/* Hero Image */}
      <div className="relative w-full max-w-sm aspect-[3/4] mb-8 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800" 
          className="object-cover w-full h-full" 
          alt="Фотосессия"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        {/* Content overlay */}
        <div className="absolute bottom-8 left-6 right-6 text-left">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-black text-white text-sm shadow-lg">
              AI
            </div>
            <span className="text-blue-400 font-black text-xs uppercase tracking-widest">Photo Studio</span>
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
        <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-300">Реалистичные фото</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span className="text-slate-300">12 стилей</span>
        </div>
      </div>

      {/* CTA Button */}
      <button 
        onClick={onStart} 
        className="btn-primary w-full max-w-sm text-base"
      >
        🚀 Начать фотосессию
      </button>
      
      <p className="text-slate-500 text-xs mt-4">
        Загрузите фото → Выберите стиль → Получите результат
      </p>
    </section>
  );
}

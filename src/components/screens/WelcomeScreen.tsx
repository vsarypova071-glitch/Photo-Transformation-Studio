import React from 'react';

interface WelcomeScreenProps {
   onStart: () => void;
 }
 
 export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
   return (
     <section className="min-h-screen flex items-center justify-center px-8 text-center flex-col">
       <div className="relative w-full max-w-sm aspect-[4/5] mb-10 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
         <img 
           src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800" 
           className="object-cover w-full h-full" 
           alt="Welcome"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
         <div className="absolute bottom-10 left-8 right-8 text-left">
           <div className="w-8 h-[2px] bg-primary mb-4 shadow-[0_0_15px_hsl(var(--primary))]" />
           <p className="text-primary font-black text-[10px] uppercase tracking-widest mb-3">Identity Lock 4.5</p>
           <h2 className="text-4xl font-extrabold leading-tight mb-4 text-foreground">
             Ваш неповторимый <br/><span className="gradient-text">образ.</span>
           </h2>
           <p className="text-muted-foreground text-xs">
             Идеальная ретушь и подбор образа с сохранением вашей индивидуальности.
           </p>
         </div>
       </div>
       <button onClick={onStart} className="btn-primary w-full max-w-sm">
         Начать
       </button>
     </section>
   );
 }
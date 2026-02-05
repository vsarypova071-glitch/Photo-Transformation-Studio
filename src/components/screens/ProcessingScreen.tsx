 import { useState, useEffect } from 'react';
 
 export default function ProcessingScreen() {
   const [seconds, setSeconds] = useState(0);
   const [status, setStatus] = useState('Анализ пропорций');
 
   useEffect(() => {
     const timer = setInterval(() => {
       setSeconds(s => {
         if (s > 5) setStatus('Масштабирование');
         if (s > 12) setStatus('Финальный рендеринг');
         return s + 1;
       });
     }, 1000);
     return () => clearInterval(timer);
   }, []);
 
   return (
     <section className="min-h-screen flex items-center justify-center px-12 text-center flex-col">
       <div className="relative w-44 h-44 mb-16">
         <div className="absolute inset-0 rounded-full border-4 border-secondary" />
         <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
         <div className="absolute inset-0 flex items-center justify-center font-bold text-4xl text-primary">
           {seconds}s
         </div>
       </div>
       <h2 className="text-4xl font-black mb-6 uppercase tracking-tight leading-tight text-foreground">
         Создание <br/> шедевра
       </h2>
       <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest animate-pulse">
         {status}
       </p>
     </section>
   );
 }
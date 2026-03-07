import { useState } from 'react';
import { Job } from '../../types';

interface ResultsScreenProps {
  job: Job;
  onRefine: (prompt: string) => void;
  onFullBody: () => void;
  onNewPhoto: () => void;
  onBackToStyles: () => void;
}

export default function ResultsScreen({ job, onRefine, onFullBody, onNewPhoto, onBackToStyles }: ResultsScreenProps) {
  const [showMagick, setShowMagick] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const resultImage = job.results[0];

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    if (resultImage.startsWith('data:')) {
      link.href = resultImage;
    } else {
      link.href = resultImage;
    }
    link.download = `portrait_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
   return (
     <section className="min-h-screen flex flex-col px-6 py-28 overflow-y-auto no-scrollbar pb-80">
       <h2 className="text-3xl font-black uppercase mb-10 text-foreground">Результат</h2>
       
       <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 mb-10 shadow-2xl group">
         <img src={resultImage} className="w-full bg-secondary min-h-[400px] object-cover" alt="Result" />
          <button
            onClick={handleDownload}
            className="absolute bottom-8 right-8 bg-primary text-primary-foreground p-5 rounded-full shadow-2xl active:scale-90 transition-all hover:scale-110"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
       </div>
 
       {!showMagick && (
         <div className="flex flex-col gap-4">
           {!job.isFullBody && (
             <button 
               onClick={onFullBody}
               className="w-full bg-primary/10 border border-primary/30 py-6 rounded-full flex items-center justify-center gap-4 transition-all active:scale-95 text-primary font-black text-xs uppercase"
             >
               <span>🕴️</span> Сделать во весь рост (1 кр.)
             </button>
           )}
           <button 
             onClick={() => setShowMagick(true)}
             className="w-full bg-secondary border border-border py-6 rounded-full flex items-center justify-center gap-4 transition-all active:scale-95 font-black text-xs uppercase"
           >
             <span>🪄</span> Магическая правка (1 кр.)
           </button>
         </div>
       )}
 
       {showMagick && (
         <div className="glass p-8 rounded-[2rem] border-primary/20 mt-6 animate-in slide-in-from-top duration-300">
           <p className="text-[10px] font-black text-primary mb-3 uppercase tracking-widest">Магическая ретушь</p>
           <textarea
             value={refinePrompt}
             onChange={(e) => setRefinePrompt(e.target.value)}
             placeholder="Например: Смени костюм на черный..."
             className="w-full bg-secondary/50 border border-border rounded-2xl p-6 text-sm mb-6 outline-none focus:border-primary text-foreground resize-none h-32"
           />
           <div className="flex gap-4">
             <button 
               onClick={() => setShowMagick(false)}
               className="flex-1 bg-secondary py-5 rounded-full font-black text-[10px] uppercase"
             >
               Отмена
             </button>
             <button 
               onClick={() => onRefine(refinePrompt)}
               className="flex-[2] bg-primary text-primary-foreground py-5 rounded-full font-black text-[10px] uppercase"
             >
               Применить
             </button>
           </div>
         </div>
       )}
 
       <div className="fixed bottom-0 left-0 right-0 p-8 glass border-t border-white/5 flex gap-4 z-50 max-w-md mx-auto">
         <button onClick={onBackToStyles} className="flex-1 bg-secondary py-5 rounded-2xl font-black text-xs uppercase">
           Стили
         </button>
         <button onClick={onNewPhoto} className="flex-[2] bg-primary text-primary-foreground py-5 rounded-2xl font-black text-xs uppercase shadow-2xl">
           Новое фото
         </button>
       </div>
     </section>
   );
 }
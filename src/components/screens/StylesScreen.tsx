import { useState } from 'react';
import { Style, StyleCategory } from '../../types';
interface StylesScreenProps {
  styles: Style[];
  selectedStyles: string[];
  activeCategory: StyleCategory;
  intensity: number;
  isFullBody: boolean;
  onSelectStyle: (id: string) => void;
  onCategoryChange: (cat: StyleCategory) => void;
  onIntensityChange: (val: number) => void;
  onFullBodyToggle: () => void;
  onBack: () => void;
  onGenerate: () => void;
}
const CATEGORIES: {
  id: StyleCategory;
  label: string;
}[] = [{
  id: 'realistic',
  label: 'РЕАЛИЗМ (12)'
}, {
  id: 'wild',
  label: 'ПРЕМИУМ'
}];
export default function StylesScreen({
  styles,
  selectedStyles,
  activeCategory,
  intensity,
  isFullBody,
  onSelectStyle,
  onCategoryChange,
  onIntensityChange,
  onFullBodyToggle,
  onBack,
  onGenerate
}: StylesScreenProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const filteredStyles = styles.filter(s => s.category === activeCategory);
  const canGenerate = selectedStyles.length > 0 || customPrompt.trim() !== '';
  return <section className="min-h-screen flex flex-col px-6 py-28 overflow-y-auto no-scrollbar pb-64">
       <div className="flex justify-between items-center mb-8 text-slate-50">
         <div>
           <h2 className="text-2xl font-black uppercase tracking-tight font-serif">Стиль образа</h2>
           <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-slate-200 font-serif">Выберите направление</p>
         </div>
         <button onClick={onBack} className="text-[10px] font-bold border-b border-border text-slate-100 font-serif">
           НАЗАД
         </button>
       </div>
 
       {/* Categories */}
       <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2 snap-x">
         {CATEGORIES.map(cat => <button key={cat.id} onClick={() => onCategoryChange(cat.id)} className={`px-5 py-3 rounded-full text-[10px] font-black border transition-all flex-shrink-0 snap-start ${activeCategory === cat.id ? 'bg-primary border-primary text-primary-foreground shadow-lg' : 'bg-secondary border-border text-muted-foreground'}`}>
             {cat.label}
           </button>)}
       </div>
 
       {/* Style Grid */}
       <div className="grid grid-cols-2 gap-4 mb-10">
         {filteredStyles.map(style => <div key={style.id} onClick={() => onSelectStyle(style.id)} className={`relative rounded-[2rem] overflow-hidden cursor-pointer border-4 transition-all active:scale-95 group ${selectedStyles.includes(style.id) ? 'border-primary scale-[1.02]' : 'border-transparent'}`}>
             <img src={style.previewUrl} className="w-full aspect-[3/4] object-cover" loading="lazy" alt={style.name} />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
             <p className="absolute bottom-4 left-4 text-[10px] font-black text-foreground uppercase">{style.name}</p>
             {selectedStyles.includes(style.id) && <div className="absolute top-4 right-4 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                 <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                 </svg>
               </div>}
           </div>)}
       </div>
 
       {/* Full Body Toggle */}
       <div onClick={onFullBodyToggle} className="glass p-6 rounded-[2.5rem] border-border mb-6 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
         <div>
           <p className="text-[10px] font-black text-primary uppercase tracking-widest">ФОРМАТ: ВО ВЕСЬ РОСТ</p>
           <p className="text-[8px] font-bold uppercase mt-1 text-slate-50">Видны обувь и полный силуэт</p>
         </div>
         <div className={`w-12 h-6 rounded-full relative transition-colors ${isFullBody ? 'bg-primary' : 'bg-secondary'}`}>
           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isFullBody ? 'left-7' : 'left-1'}`} />
         </div>
       </div>
 
       {/* Intensity */}
       <div className="glass p-6 rounded-[2.5rem] border-border mb-8">
         <div className="flex justify-between items-center mb-6">
           <p className="text-[10px] font-black text-primary uppercase tracking-widest">ИНТЕНСИВНОСТЬ</p>
           <span className="text-[10px] font-mono text-primary-foreground bg-primary px-2 py-1 rounded-md">{intensity}%</span>
         </div>
         <input type="range" min="10" max="100" value={intensity} onChange={e => onIntensityChange(Number(e.target.value))} className="w-full accent-primary" />
       </div>
 
       {/* Custom Prompt */}
       <div className="glass p-6 rounded-[2rem] border-border mb-10">
         <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">ПОЖЕЛАНИЯ</p>
         <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Например: добавьте очки, поменяйте фон..." className="w-full bg-background/50 border border-border rounded-2xl p-4 text-xs h-28 outline-none focus:border-primary text-foreground resize-none" />
       </div>
 
       {/* Fixed Bottom Button */}
       <div className="fixed bottom-0 left-0 right-0 p-6 glass border-t border-white/5 z-50 max-w-md mx-auto">
          <button onClick={onGenerate} disabled={!canGenerate} className="btn-shimmer w-full py-5 px-8 rounded-full font-semibold text-sm text-white uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            ✦ Создать шедевр
          </button>
       </div>
     </section>;
}
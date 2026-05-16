import { useState } from 'react';
import { Style, StyleCategory } from '../../types';

interface StylesScreenProps {
  styles: Style[];
  selectedStyles: string[];
  selectedGoal: string | null;
  activeCategory: StyleCategory;
  isFullBody: boolean;
  onSelectStyle: (id: string) => void;
  onCategoryChange: (cat: StyleCategory) => void;
  onFullBodyToggle: () => void;
  onBack: () => void;
  onGenerate: () => void;
}

// Hero-стили: на табе "ВСЕ" БОГИНЯ стоит первой и занимает всю ширину.
// ЛИДЕР и РОСКОШЬ — следующие два и получают бейдж.
const HERO_IDS = ['intellectual_elegance', 'business_elite', 'old_money'] as const;
const HERO_BADGE_IDS = new Set(['intellectual_elegance', 'business_elite', 'old_money']);

const GOAL_CONFIG: Record<string, { priority: string[]; recommended: string }> = {
  work: {
    priority: ['business_elite', 'social_portrait', 'elite_sport'],
    recommended: 'business_elite',
  },
  dating: {
    priority: ['intellectual_elegance', 'parisian_chic', 'royal_bear'],
    recommended: 'intellectual_elegance',
  },
  social: {
    priority: ['old_money', 'evening_glamour', 'quiet_luxury'],
    recommended: 'old_money',
  },
};

const CATEGORIES: { id: StyleCategory; label: string }[] = [
  { id: 'all',      label: 'ВСЕ' },
  { id: 'business', label: 'БИЗНЕС' },
  { id: 'women',    label: 'ЖЕНСКИЕ' },
  { id: 'travel',   label: 'ПУТЕШЕСТВИЯ' },
  { id: 'nature',   label: 'ПРИРОДА' },
  { id: 'sport',    label: 'СПОРТ' },
  { id: 'bright',   label: 'ЯРКИЕ' },
  { id: 'kids',     label: 'ДЕТИ' },
];

export default function StylesScreen({
  styles,
  selectedStyles,
  selectedGoal,
  activeCategory,
  isFullBody,
  onSelectStyle,
  onCategoryChange,
  onFullBodyToggle,
  onBack,
  onGenerate,
}: StylesScreenProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const canGenerate = selectedStyles.length > 0 || customPrompt.trim() !== '';

  // Фильтрация: 'all' показывает все взрослые стили (не kids)
  const adultCategories = new Set(['business', 'women', 'travel', 'nature', 'sport', 'bright', 'realistic', 'wild']);
  const filteredStyles = activeCategory === 'all'
    ? styles.filter(s => adultCategories.has(s.category))
    : styles.filter(s => s.category === activeCategory);

  // На табе 'all': hero-стили идут первыми в заданном порядке, остальные — по умолчанию.
  const displayStyles = activeCategory === 'all'
    ? [
        ...HERO_IDS.map(id => filteredStyles.find(s => s.id === id)).filter((s): s is Style => Boolean(s)),
        ...filteredStyles.filter(s => !HERO_IDS.includes(s.id as typeof HERO_IDS[number])),
      ]
    : filteredStyles;

  const renderStyleCard = (style: Style, heroFirst = false) => {
    const isSelected = selectedStyles.includes(style.id);
    const isHeroBadge = activeCategory === 'all' && HERO_BADGE_IDS.has(style.id);

    return (
      <div
        key={style.id}
        onClick={() => onSelectStyle(style.id)}
        style={{ transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease' }}
        className={`relative rounded-[2rem] overflow-hidden cursor-pointer group
          ${heroFirst ? 'col-span-2' : ''}
          ${isSelected
            ? 'scale-[1.03] ring-4 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_28px_4px_hsl(var(--primary)/0.55),0_8px_24px_hsl(var(--primary)/0.2)]'
            : 'ring-4 ring-transparent hover:ring-primary/25 hover:scale-[1.02] hover:shadow-[0_6px_20px_hsl(var(--primary)/0.18)] active:scale-[0.98]'
          }`}
      >
        <img
          src={style.previewUrl}
          style={{ transition: 'transform 250ms ease' }}
          className={`w-full object-cover group-hover:scale-[1.04] ${heroFirst ? 'aspect-[16/9]' : 'aspect-[3/4]'}`}
          loading="lazy"
          alt={style.name}
        />
        <div
          style={{ transition: 'opacity 200ms ease' }}
          className={`absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent ${isSelected ? 'opacity-90' : 'opacity-75 group-hover:opacity-82'}`}
        />
        {/* Hero badge */}
        {isHeroBadge && !isSelected && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary/90 text-[8px] font-black text-primary-foreground uppercase tracking-widest">
            ★ ТОП
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className={`font-black text-foreground uppercase leading-tight tracking-wide ${heroFirst ? 'text-sm' : 'text-[10px]'}`}>
            {style.name}
          </p>
          {style.description && (
            <p className={`font-medium text-muted-foreground mt-1 leading-tight line-clamp-2 ${heroFirst ? 'text-[10px]' : 'text-[8px]'}`}>
              {style.description}
            </p>
          )}
        </div>
        {isSelected && (
          <div
            style={{ animation: 'scale-in 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
            className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg"
          >
            <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="min-h-screen flex flex-col px-6 py-28 overflow-y-auto no-scrollbar pb-64">
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
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`px-5 py-3 rounded-full text-[10px] font-black border transition-all flex-shrink-0 snap-start ${
              activeCategory === cat.id
                ? 'bg-primary border-primary text-primary-foreground shadow-lg'
                : 'bg-secondary border-border text-muted-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Styles grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {displayStyles.map((style, i) => {
          // На табе 'all': первый стиль (БОГИНЯ) — полноширинный hero
          const isHeroFirst = activeCategory === 'all' && i === 0;
          return renderStyleCard(style, isHeroFirst);
        })}
      </div>

      {/* Full Body Toggle */}
      <div
        onClick={onFullBodyToggle}
        className="glass p-6 rounded-[2.5rem] border-border mb-6 flex items-center justify-between cursor-pointer active:scale-95 transition-all"
      >
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">ФОРМАТ: ВО ВЕСЬ РОСТ</p>
          <p className="text-[8px] font-bold uppercase mt-1 text-slate-50">Видны обувь и полный силуэт</p>
        </div>
        <div className={`w-12 h-6 rounded-full relative transition-colors ${isFullBody ? 'bg-primary' : 'bg-secondary'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isFullBody ? 'left-7' : 'left-1'}`} />
        </div>
      </div>

      {/* Custom Prompt */}
      <div className="glass p-6 rounded-[2rem] border-border mb-10">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">ПОЖЕЛАНИЯ</p>
        <textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="Например: добавьте очки, поменяйте фон..."
          className="w-full bg-background/50 border border-border rounded-2xl p-4 text-xs h-28 outline-none focus:border-primary text-foreground resize-none"
        />
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 glass border-t border-white/5 z-50 max-w-md mx-auto flex gap-3">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="btn-shimmer flex-1 py-5 px-8 rounded-full font-semibold text-sm text-white uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed opacity-95"
        >
          ✦ Создать шедевр
        </button>
      </div>
    </section>
  );
}

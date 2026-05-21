import { useState } from 'react';
import { Style, StyleCategory, GenderMode } from '../../types';

interface StylesScreenProps {
  styles: Style[];
  selectedStyles: string[];
  selectedGoal: string | null;
  activeCategory: StyleCategory;
  genderMode: GenderMode;
  isFullBody: boolean;
  onSelectStyle: (id: string) => void;
  onCategoryChange: (cat: StyleCategory) => void;
  onGenderChange: (mode: GenderMode) => void;
  onFullBodyToggle: () => void;
  onBack: () => void;
  onGenerate: () => void;
}

const CATEGORIES: { id: StyleCategory; label: string }[] = [
  { id: 'realistic', label: 'РЕАЛИЗМ' },
  { id: 'premium',  label: 'ПРЕМИУМ' },
  { id: 'kids',     label: 'ДЕТИ' },
  { id: 'together', label: 'ПАРНЫЕ' },
];

export default function StylesScreen({
  styles,
  selectedStyles,
  selectedGoal: _selectedGoal,
  activeCategory,
  genderMode,
  isFullBody,
  onSelectStyle,
  onCategoryChange,
  onGenderChange,
  onFullBodyToggle,
  onBack,
  onGenerate,
}: StylesScreenProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const canGenerate = selectedStyles.length > 0 || customPrompt.trim() !== '';

  // Pair-gate: когда выбран парный стиль, показываем инфо-блок перед отправкой на оплату
  const [showPairInfo, setShowPairInfo] = useState(false);
  const isPairSelected = styles.some(
    s => selectedStyles.includes(s.id) && s.category === 'together'
  );

  // Сбросить gate при смене набора стилей
  const handleSelectStyle = (id: string) => {
    setShowPairInfo(false);
    onSelectStyle(id);
  };

  const filteredStyles = styles.filter(s => s.category === activeCategory);

  const renderStyleCard = (style: Style) => {
    const isSelected = selectedStyles.includes(style.id);

    return (
      <div
        key={style.id}
        onClick={() => handleSelectStyle(style.id)}
        style={{ transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease' }}
        className={`relative rounded-[2rem] overflow-hidden cursor-pointer group
          ${isSelected
            ? 'scale-[1.03] ring-4 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_28px_4px_hsl(var(--primary)/0.55),0_8px_24px_hsl(var(--primary)/0.2)]'
            : 'ring-4 ring-transparent hover:ring-primary/25 hover:scale-[1.02] hover:shadow-[0_6px_20px_hsl(var(--primary)/0.18)] active:scale-[0.98]'
          }`}
      >
        <img
          src={style.previewUrl}
          style={{ transition: 'transform 250ms ease' }}
          className="w-full aspect-[3/4] object-cover group-hover:scale-[1.04]"
          loading="lazy"
          alt={style.name}
        />
        <div
          style={{ transition: 'opacity 200ms ease' }}
          className={`absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent ${isSelected ? 'opacity-90' : 'opacity-75 group-hover:opacity-82'}`}
        />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-[10px] font-black text-foreground uppercase leading-tight tracking-wide">
            {style.name}
          </p>
          {style.description && (
            <p className="text-[8px] font-medium text-muted-foreground mt-1 leading-tight line-clamp-2">
              {style.description}
            </p>
          )}
        </div>
        {/* Бейдж «2 фото» для парных стилей */}
        {style.category === 'together' && (
          <div className="absolute top-3 left-3 z-10 bg-black/65 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <span className="text-[8px] font-black text-white uppercase tracking-wide">👥 2 фото</span>
          </div>
        )}
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

      {/* Gender toggle — скрыт для парных фото (там 2 разных человека) */}
      {activeCategory !== 'together' && (
        <div className="flex mb-6 rounded-full bg-secondary border border-border p-1 gap-1">
          {(['female', 'male'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onGenderChange(mode)}
              className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                genderMode === mode
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground'
              }`}
            >
              {mode === 'female' ? 'Женский' : 'Мужской'}
            </button>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`px-5 py-3 rounded-full text-[10px] font-black border transition-all flex-shrink-0 ${
              activeCategory === cat.id
                ? 'bg-primary border-primary text-primary-foreground shadow-lg'
                : 'bg-secondary border-border text-muted-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Парные фото — пояснение */}
      {activeCategory === 'together' && (
        <div className="mb-6 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/30 text-xs text-foreground/90 leading-relaxed">
          <p className="font-black text-primary uppercase tracking-wider text-[10px] mb-1">👥 Два фото — один результат</p>
          <p className="text-muted-foreground">
            Загрузите фото двух людей и получите одно совместное AI-фото.
            Стоимость: <strong className="text-foreground">2 генерации</strong> за снимок.
          </p>
        </div>
      )}

      {/* Styles grid — uniform 2-column */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {filteredStyles.map(style => renderStyleCard(style))}
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
      <div className="fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50 max-w-md mx-auto">

        {/* Pair-info панель — появляется при первом нажатии на «Создать шедевр» с парным стилем */}
        {showPairInfo && isPairSelected && (
          <div className="px-6 pt-5 pb-1">
            <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4 space-y-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-wider">
                👥 Для парного фото нужны 2 фотографии
              </p>
              <div className="flex items-center gap-2 text-[10px] text-foreground/80">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Фото первого человека уже загружено</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Второе фото вы загрузите в <strong className="text-foreground">Студии</strong> после пополнения баланса.
                Без него генерация не запустится.
              </p>
            </div>
          </div>
        )}

        <div className="p-6 flex gap-3">
          <button
            onClick={() => {
              if (isPairSelected && !showPairInfo) {
                setShowPairInfo(true);
                return;
              }
              onGenerate();
            }}
            disabled={!canGenerate}
            className="btn-shimmer flex-1 py-5 px-8 rounded-full font-semibold text-sm text-white uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed opacity-95"
          >
            {showPairInfo && isPairSelected ? '✦ Продолжить к оплате' : '✦ Создать шедевр'}
          </button>
        </div>
      </div>
    </section>
  );
}

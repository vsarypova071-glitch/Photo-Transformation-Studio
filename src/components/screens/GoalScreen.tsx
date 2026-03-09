interface GoalScreenProps {
  onSelectGoal: (goal: string) => void;
}

const GOALS = [
  {
    id: 'work',
    emoji: '💼',
    title: 'Для работы',
    description: 'Фото для резюме и делового профиля',
  },
  {
    id: 'dating',
    emoji: '💘',
    title: 'Для знакомств',
    description: 'Привлекательные фото для профиля знакомств',
  },
  {
    id: 'social',
    emoji: '📱',
    title: 'Для соцсетей',
    description: 'Стильные фото для Instagram и аватарки',
  },
  {
    id: 'personal',
    emoji: '✨',
    title: 'Личная фотосессия',
    description: 'Красивые портреты как после студийной съёмки',
  },
];

export default function GoalScreen({ onSelectGoal }: GoalScreenProps) {
  return (
    <section className="min-h-screen flex flex-col items-center px-5 py-16">
      <div className="mb-8 text-center">
        <span className="text-[9px] uppercase tracking-[0.4em] text-white/60 font-semibold bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-1.5 rounded-full">
          AI Photo Studio
        </span>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-[26px] font-semibold text-white leading-tight mb-3">
          Для чего вам фото?
        </h2>
        <p className="text-[12px] text-white/60 font-light max-w-xs mx-auto leading-relaxed">
          AI поможет подобрать подходящий стиль фотосессии
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {GOALS.map((goal, i) => (
          <button
            key={goal.id}
            onClick={() => onSelectGoal(goal.id)}
            className="flex items-center gap-4 w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl px-5 py-4 text-left transition-all active:scale-[0.97]"
            style={{ animation: `fade-in 0.4s ease-out ${i * 80}ms both` }}
          >
            <span className="text-3xl flex-shrink-0">{goal.emoji}</span>
            <div>
              <p className="text-[14px] font-semibold text-white leading-snug">{goal.title}</p>
              <p className="text-[11px] text-white/50 leading-snug mt-0.5">{goal.description}</p>
            </div>
            <span className="ml-auto text-white/30 text-lg flex-shrink-0">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}

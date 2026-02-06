import React from 'react';

interface Tariff {
  id: string;
  name: string;
  photos: number;
  price: number;
  popular?: boolean;
}

const TARIFFS: Tariff[] = [
  { id: 'basic', name: 'Базовый', photos: 5, price: 479 },
  { id: 'standard', name: 'Стандарт', photos: 15, price: 1299, popular: true },
  { id: 'premium', name: 'Премиум', photos: 50, price: 2999 },
];

interface TariffScreenProps {
  onSelectTariff: (tariff: Tariff) => void;
  onBack: () => void;
}

export default function TariffScreen({ onSelectTariff, onBack }: TariffScreenProps) {
  return (
    <section className="min-h-screen px-4 py-6 pt-20">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Назад
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Выберите тариф</h2>
        <p className="text-muted-foreground text-sm">
          Выберите количество фотографий для генерации
        </p>
      </div>

      {/* Tariff Cards */}
      <div className="space-y-4">
        {TARIFFS.map((tariff) => (
          <button
            key={tariff.id}
            onClick={() => onSelectTariff(tariff)}
            className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
              tariff.popular 
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20' 
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {/* Popular Badge */}
            {tariff.popular && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
                Популярный
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1">{tariff.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {tariff.photos} {tariff.photos === 5 ? 'фото' : tariff.photos === 15 ? 'фото' : 'фото'}
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-black text-primary">
                  {tariff.price.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(tariff.price / tariff.photos)} ₽ / фото
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  HD качество
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Быстрая генерация
                </span>
                {tariff.photos >= 15 && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Все стили
                  </span>
                )}
                {tariff.photos >= 50 && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Приоритет
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Info */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        💳 Безопасная оплата через ЮKassa
      </p>
    </section>
  );
}

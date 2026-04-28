import React, { useState, useEffect } from "react";

interface Tariff {
  id: string;
  name: string;
  photos: number;
  price: number;
  popular?: boolean;
}

const TARIFFS: Tariff[] = [
  { id: "basic", name: "Базовый", photos: 5, price: 479 },
  { id: "standard", name: "Стандарт", photos: 15, price: 1299, popular: true },
  { id: "premium", name: "Премиум", photos: 50, price: 2999 },
];

interface TariffScreenProps {
  onSelectTariff: (tariff: Tariff) => void;
  onBack: () => void;
  paymentError?: string | null;
  isProcessing?: boolean;
}

function getCustomerKey(): string | null {
  return localStorage.getItem('customer_key');
}

// 1 генерация / 2 генерации / 5 генераций
function pluralGen(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'генерация';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'генерации';
  return 'генераций';
}

export default function TariffScreen({
  onSelectTariff,
  onBack,
  paymentError,
  isProcessing = false,
}: TariffScreenProps) {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);

  useEffect(() => {
    const key = getCustomerKey();
    if (!key) return;
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-balance?customer_key=${encodeURIComponent(key)}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    )
      .then(r => r.json())
      .then(d => setCreditBalance(d.balance ?? 0))
      .catch(() => {});
  }, []);

  const privacyUrl =
    "https://docs.google.com/document/d/1kGEom55-I2nqWQpFlMjXbYhVHh4lwHKKFR4bjReek40/edit?usp=sharing";

  return (
    <section className="min-h-screen px-4 py-6 pt-20">
      <button
        onClick={onBack}
        className="flex items-center gap-2 transition-colors mb-6 text-slate-200">
        ← Назад
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Выберите тариф</h2>
        <p className="text-sm text-muted-foreground">
          Выберите количество фотографий для генерации
        </p>
        {creditBalance !== null && creditBalance > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            💎 Баланс: {creditBalance} {pluralGen(creditBalance)}
          </div>
        )}
      </div>

      {paymentError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 text-center">
          {paymentError}
        </div>
      )}

      <div className="space-y-4">
        {TARIFFS.map((tariff) => {
          const isSelected = selectedTariff?.id === tariff.id;
          return (
            <div
              key={tariff.id}
              onClick={() => setSelectedTariff(tariff)}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden cursor-pointer
                ${isSelected
                  ? "border-primary bg-primary/15 shadow-lg shadow-primary/30 ring-2 ring-primary/40"
                  : tariff.popular
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                    : "border-border bg-card hover:border-primary/50"}
              `}>
              {tariff.popular && (
                <div className="absolute top-0 right-0 text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl bg-yellow-300">
                  Популярный
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1">{tariff.name}</h3>
                  <p className="text-sm text-slate-50">{tariff.photos} фото</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-50">
                    {tariff.price.toLocaleString("ru-RU")} ₽
                  </div>
                  <div className="text-xs text-slate-200">
                    {Math.round(tariff.price / tariff.photos)} ₽ / фото
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-wrap gap-2 text-xs text-emerald-400">
                  <span>✔ HD качество</span>
                  <span>✔ Быстрая генерация</span>
                  {tariff.photos >= 15 && <span>✔ Все стили</span>}
                  {tariff.photos >= 50 && <span>✔ Приоритет</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Чекбокс согласия — перед кнопками оплаты */}
      <div className="mt-6 mb-4 rounded-2xl border border-border bg-card p-4">
        <label className="flex items-start gap-3 text-sm leading-5 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 flex-shrink-0"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
          />
          <span className="text-muted-foreground">
            Я принимаю условия{" "}
            <a
              href="https://docs.google.com/document/d/15IpEOrOKkaEZ9MVpB2cvkeh1HGzYXr4jH3zne9BheRM/edit?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
              onClick={(e) => e.stopPropagation()}>
              Публичной оферты
            </a>
            {" "}и{" "}
            <a
              href={privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
              onClick={(e) => e.stopPropagation()}>
              Политики конфиденциальности
            </a>
          </span>
        </label>
      </div>

      <button
        onClick={() => selectedTariff && onSelectTariff(selectedTariff)}
        disabled={!acceptedPrivacy || !selectedTariff || isProcessing}
        className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
          ${!acceptedPrivacy || !selectedTariff || isProcessing
            ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/40"}
        `}>
        {isProcessing ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Открываем ЮKassa…
          </>
        ) : selectedTariff ? (
          <>💳 Оплатить {selectedTariff.name} — {selectedTariff.price.toLocaleString("ru-RU")} ₽</>
        ) : (
          <>Выберите тариф выше</>
        )}
      </button>

      {!selectedTariff && (
        <p className="text-center text-xs mt-2 text-muted-foreground">
          Нажмите на карточку тарифа, чтобы выбрать
        </p>
      )}
      {selectedTariff && !acceptedPrivacy && (
        <p className="text-center text-xs mt-2 text-muted-foreground">
          Подтвердите согласие с офертой выше
        </p>
      )}

      <p className="text-center text-[11px] mt-6 leading-relaxed px-4 text-slate-200">
        После оплаты начисляются кредиты для генерации AI-фото<br />
        Результат за 30–60 секунд • Безопасная оплата через ЮKassa
      </p>
    </section>
  );
}

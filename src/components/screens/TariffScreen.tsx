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
  onPayWithCredits: (tariff: Tariff) => void;
  onBack: () => void;
  paymentError?: string | null;
}

function getCustomerKey(): string | null {
  return localStorage.getItem('customer_key');
}

export default function TariffScreen({
  onSelectTariff,
  onPayWithCredits,
  onBack,
  paymentError,
}: TariffScreenProps) {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [highlightPrivacy, setHighlightPrivacy] = useState(false);

  const ensurePrivacy = (): boolean => {
    if (!acceptedPrivacy) {
      setHighlightPrivacy(true);
      const el = document.getElementById('privacy-consent-block');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightPrivacy(false), 1800);
      return false;
    }
    return true;
  };

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
            💎 Баланс: {creditBalance} кредитов
          </div>
        )}
      </div>

      {paymentError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 text-center">
          {paymentError}
        </div>
      )}

      <div
        id="privacy-consent-block"
        className={`mb-6 rounded-2xl border bg-card p-4 transition-all ${
          highlightPrivacy
            ? "border-red-500 ring-2 ring-red-500/40 animate-pulse"
            : "border-border"
        }`}>
        <label className="flex items-start gap-3 text-sm leading-5 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
          />
          <span className="text-muted-foreground">
            Я соглашаюсь с{" "}
            <a
              href="https://docs.google.com/document/d/15IpEOrOKkaEZ9MVpB2cvkeh1HGzYXr4jH3zne9BheRM/edit?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
              onClick={(e) => e.stopPropagation()}>
              Публичной офертой
            </a>
            {" "}и{" "}
            <a
              href={privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
              onClick={(e) => e.stopPropagation()}>
              Политикой конфиденциальности
            </a>
          </span>
        </label>
        {highlightPrivacy && (
          <p className="mt-2 text-xs text-red-400 font-medium">
            ⚠ Поставьте галочку, чтобы продолжить
          </p>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground mb-2">Стоимость услуг:</p>
        <p>Базовый пакет — 479 ₽ (5 фотографий)</p>
        <p>Стандартный пакет — 1 299 ₽ (15 фотографий)</p>
        <p>Премиум пакет — 2 999 ₽ (50 фотографий)</p>
        <p className="mt-2">Оплата производится онлайн на сайте.</p>
      </div>

      <div className="space-y-4">
        {TARIFFS.map((tariff) => {
          const canPayWithCredits = creditBalance !== null && creditBalance >= tariff.photos;

          return (
            <div
              key={tariff.id}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden
                ${tariff.popular
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                  : "border-border bg-card"}
              `}>
              {tariff.popular && (
                <div className="absolute top-0 right-0 text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl bg-yellow-300 pointer-events-none">
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

              <div className="mt-4 flex gap-2 relative z-10">
                {canPayWithCredits && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!ensurePrivacy()) return;
                      onPayWithCredits(tariff);
                    }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                    💎 Оплатить кредитами ({tariff.photos})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!ensurePrivacy()) return;
                    onSelectTariff(tariff);
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
                  💳 Оплатить {tariff.price.toLocaleString("ru-RU")} ₽
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs mt-6 text-slate-50">
        💳 Безопасная оплата через ЮKassa
      </p>
      <p className="text-center text-[10px] mt-2 leading-relaxed px-4 text-slate-200">
        После оплаты запускается генерация AI-фотографий<br />
        на основе загруженного изображения и выбранного стиля.<br />
        Результаты предоставляются в цифровом виде.
      </p>
    </section>
  );
}

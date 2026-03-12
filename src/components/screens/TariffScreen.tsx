import React, { useState } from "react";

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
{ id: "premium", name: "Премиум", photos: 50, price: 2999 }];


interface TariffScreenProps {
  onSelectTariff: (tariff: Tariff) => void;
  onBack: () => void;
}

export default function TariffScreen({
  onSelectTariff,
  onBack
}: TariffScreenProps) {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const privacyUrl =
  "https://docs.google.com/document/d/1kGEom55-I2nqWQpFlMjXbYhVHh4lwHKKFR4bjReek40/edit?usp=sharing";

  return (
    <section className="min-h-screen px-4 py-6 pt-20">
      {/* Назад */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 transition-colors mb-6 text-slate-200">
        
        ← Назад
      </button>

      {/* Заголовок */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Выберите тариф</h2>
        <p className="text-sm text-slate-200">
          Выберите количество фотографий для генерации
        </p>
      </div>

      {/* Галочка согласия */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <label className="flex items-start gap-3 text-sm leading-5 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
          
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
      </div>

      {/* Карточки тарифов */}
      <div className="space-y-4">
        {TARIFFS.map((tariff) => {
          const disabled = !acceptedPrivacy;

          return (
            <button
              key={tariff.id}
              onClick={() => onSelectTariff(tariff)}
              disabled={disabled}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden
                ${
              tariff.popular ?
              "border-primary bg-primary/5 shadow-lg shadow-primary/20" :
              "border-border bg-card"}
                ${

              disabled ?
              "opacity-50 cursor-not-allowed" :
              "hover:border-primary/50"}
              `
              }>
              
              {tariff.popular &&
              <div className="absolute top-0 right-0 text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl bg-yellow-300">
                  Популярный
                </div>
              }

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1">
                    {tariff.name}
                  </h3>
                  <p className="text-sm text-slate-50">
                    {tariff.photos} фото
                  </p>
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
            </button>);

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
    </section>);

}
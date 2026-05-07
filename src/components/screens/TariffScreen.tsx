import React, { useState, useEffect } from "react";
import { getBalance } from "@/services/api";

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
  onSelectTariff: (tariff: Tariff, email: string) => void;
  onBack: () => void;
  paymentError?: string | null;
  isProcessing?: boolean;
}

function getCustomerKey(): string | null {
  return localStorage.getItem('customer_key');
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
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
  const [email, setEmail] = useState(() => localStorage.getItem('customer_email') || '');

  useEffect(() => {
    const key = getCustomerKey();
    if (!key) return;
    getBalance(key)
      .then((d) => setCreditBalance(d.balance ?? 0))
      .catch(() => {});
  }, []);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEmail(val);
    localStorage.setItem('customer_email', val);
  }

  const canSubmit = acceptedPrivacy && !!selectedTariff && !isProcessing && isValidEmail(email);

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

      {/* Email для чека (54-ФЗ) — выделенный блок */}
      <div className={`mt-6 rounded-2xl border-2 p-5 transition-all
        ${!email
          ? "border-yellow-400/70 bg-yellow-400/10 shadow-lg shadow-yellow-400/20 animate-pulse-subtle"
          : !isValidEmail(email)
            ? "border-red-500/70 bg-red-500/10"
            : "border-emerald-500/50 bg-emerald-500/5"}
      `}>
        <label htmlFor="customer-email" className="flex items-center gap-2 text-base font-bold text-slate-50 mb-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-black text-xs font-black">1</span>
          Email для чека и результатов
        </label>
        <input
          id="customer-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Введите ваш email"
          value={email}
          onChange={handleEmailChange}
          className={`w-full rounded-xl border-2 px-4 py-4 text-base font-medium bg-white text-slate-900 placeholder:text-slate-400 outline-none transition-colors shadow-inner
            ${email && !isValidEmail(email)
              ? "border-red-500 focus:border-red-600"
              : "border-yellow-400/60 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/30"}
          `}
        />
        <p className="mt-2.5 text-xs text-slate-200 leading-relaxed">
          📩 На этот email придёт <strong className="text-slate-50">чек об оплате</strong> и <strong className="text-slate-50">доступ к результатам</strong>
        </p>
        {email && !isValidEmail(email) && (
          <p className="mt-1.5 text-xs text-red-400 font-semibold">⚠ Введите корректный email</p>
        )}
      </div>

      {/* Чекбокс согласия */}
      <div className="mt-4 mb-4 rounded-2xl border border-border bg-card p-4">
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
        onClick={() => selectedTariff && canSubmit && onSelectTariff(selectedTariff, email.trim())}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
          ${!canSubmit
            ? "opacity-60 cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/40 active:scale-[0.98]"}
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

      {/* Причина disabled — крупно и заметно, чтобы было ясно почему кнопка серая */}
      {!selectedTariff && (
        <p className="text-center text-sm mt-3 font-semibold text-yellow-300">
          ↑ Нажмите на карточку тарифа выше, чтобы выбрать
        </p>
      )}
      {selectedTariff && !email && (
        <p className="text-center text-sm mt-3 font-semibold text-red-400 flex items-center justify-center gap-2">
          <span>⚠</span> Введите email, чтобы продолжить оплату
        </p>
      )}
      {selectedTariff && email && !isValidEmail(email) && (
        <p className="text-center text-sm mt-3 font-semibold text-red-400 flex items-center justify-center gap-2">
          <span>⚠</span> Email указан некорректно
        </p>
      )}
      {selectedTariff && isValidEmail(email) && !acceptedPrivacy && (
        <p className="text-center text-sm mt-3 font-semibold text-yellow-300">
          ↑ Подтвердите согласие с офертой
        </p>
      )}

      <p className="text-center text-[11px] mt-6 leading-relaxed px-4 text-slate-200">
        После оплаты начисляются кредиты для генерации AI-фото<br />
        Результат за 30–60 секунд • Безопасная оплата через ЮKassa
      </p>
    </section>
  );
}

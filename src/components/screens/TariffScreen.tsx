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
  return localStorage.getItem("customer_key");
}

export default function TariffScreen({
  onSelectTariff,
  onPayWithCredits,
  onBack,
  paymentError,
}: TariffScreenProps) {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    const key = getCustomerKey();
    if (!key) return;

    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-balance?customer_key=${encodeURIComponent(
        key
      )}`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    )
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance ?? 0))
      .catch(() => {});
  }, []);

  return (
    <section className="min-h-screen px-4 py-6 pt-20">
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6 text-slate-200"
      >
        ← Назад
      </button>

      <h2 className="text-2xl font-bold mb-2 text-center">
        Выберите тариф
      </h2>

      {creditBalance !== null && creditBalance > 0 && (
        <div className="text-center mb-4 text-green-400">
          Баланс: {creditBalance} кредитов
        </div>
      )}

      {paymentError && (
        <div className="mb-4 text-red-400 text-center">
          {paymentError}
        </div>
      )}

      {/* ЧЕКБОКС */}
      <label className="flex items-center gap-2 mb-6 text-sm">
        <input
          type="checkbox"
          checked={acceptedPrivacy}
          onChange={(e) => setAcceptedPrivacy(e.target.checked)}
        />
        Я принимаю условия
      </label>

      {/* ТАРИФЫ */}
      <div className="space-y-4">
        {TARIFFS.map((tariff) => {
          const canPayWithCredits =
            creditBalance !== null && creditBalance >= tariff.photos;

          const disabled = !acceptedPrivacy;

          return (
            <div
              key={tariff.id}
              className="border rounded-xl p-4 bg-card"
            >
              <h3 className="text-lg font-semibold">{tariff.name}</h3>
              <p>{tariff.photos} фото</p>
              <p className="mb-3">{tariff.price} ₽</p>

              <div className="flex gap-2">
                {canPayWithCredits && (
                  <button
                    onClick={() => onPayWithCredits(tariff)}
                    disabled={disabled}
                    className={`flex-1 py-2 rounded-xl ${
                      disabled
                        ? "opacity-50 bg-gray-500"
                        : "bg-green-600 text-white"
                    }`}
                  >
                    Оплатить кредитами
                  </button>
                )}

                <button
                  onClick={() => onSelectTariff(tariff)}
                  disabled={disabled}
                  className={`flex-1 py-2 rounded-xl ${
                    disabled
                      ? "opacity-50 bg-gray-500"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  Оплатить
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

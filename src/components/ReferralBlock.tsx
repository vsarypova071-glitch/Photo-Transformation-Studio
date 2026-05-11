// Блок «Пригласи друга». Рендерится только если flag.enableReferrals === true.
// Если backend вернёт 404 (flag off на сервере) — блок просто скрывается.

import { useEffect, useState } from 'react';
import { fetchMyReferral, type MyReferral } from '@/services/referrals';
import { flags } from '@/lib/featureFlags';

interface Props {
  customerKey: string;
}

export default function ReferralBlock({ customerKey }: Props) {
  const [info, setInfo] = useState<MyReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!flags.enableReferrals) return;
    if (!customerKey) return;
    let cancelled = false;
    setLoading(true);
    fetchMyReferral(customerKey)
      .then((r) => { if (!cancelled) setInfo(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerKey]);

  if (!flags.enableReferrals) return null;
  if (loading) return null;
  if (!info) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(info.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select and prompt
      window.prompt('Скопируйте ссылку:', info.referralLink);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5">
      <h3 className="text-base font-black text-yellow-300 mb-2 flex items-center gap-2">
        🎁 Пригласите друга
      </h3>
      <p className="text-xs text-slate-200 leading-relaxed mb-3">
        Получите <strong className="text-yellow-300">+1 генерацию</strong>, когда друг оплатит первый пакет.
      </p>

      <div className="rounded-xl bg-background/80 border border-border p-3 mb-3 flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-foreground truncate">{info.referralLink}</code>
        <button
          onClick={onCopy}
          className="rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs px-3 py-2 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          {copied ? '✓ Скопировано' : 'Скопировать'}
        </button>
      </div>

      <div className="flex gap-3 text-xs">
        <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
          <div className="text-2xl font-black text-foreground">{info.grantedCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">друзей оплатили</div>
        </div>
        <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
          <div className="text-2xl font-black text-yellow-300">+{info.bonusCreditsTotal}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">бонус-генераций</div>
        </div>
      </div>
    </section>
  );
}

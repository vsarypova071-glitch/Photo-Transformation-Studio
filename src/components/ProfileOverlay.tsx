import React, { useState } from 'react';
import { User } from '../types';
 
interface ProfileOverlayProps {
  user: User;
  onClose: () => void;
  onActivateCode: (code: string) => Promise<{ success: boolean; message: string }>;
  onSignOut: () => void;
}
 
export default function ProfileOverlay({ user, onClose, onActivateCode, onSignOut }: ProfileOverlayProps) {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleActivate = async () => {
    if (!promoCode.trim()) {
      setMessage({ text: 'Введите промокод', isError: true });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await onActivateCode(promoCode.trim());
    
    setMessage({ text: result.message, isError: !result.success });
    if (result.success) {
      setPromoCode('');
    }
    
    setLoading(false);
  };

  return (
    <section className="fixed inset-0 z-[100] glass flex flex-col p-10 max-w-md mx-auto overflow-y-auto">
      <div className="flex justify-between items-center mb-16">
        <h2 className="text-4xl font-black uppercase text-foreground">Профиль</h2>
        <button 
          onClick={onClose}
          className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center text-muted-foreground border border-border"
        >
          ✕
        </button>
      </div>
      
      {/* User info card */}
      <div className="glass p-10 rounded-[3.5rem] border-primary/10 mb-10 shadow-2xl">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Тариф</p>
        <h3 className="text-5xl font-black mb-6 uppercase text-foreground">{user.plan}</h3>
        <div className="flex justify-between items-end">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Баланс:</p>
          <p className="text-4xl font-black text-foreground">
            {user.remainingCredits} <span className="text-sm text-muted-foreground font-bold">ед.</span>
          </p>
        </div>
      </div>

      {/* Promo code section */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Промокод
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="CODE-XXX-XXX"
            className="flex-1 px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground uppercase"
            disabled={loading}
          />
          <button 
            onClick={handleActivate}
            disabled={loading}
            className="btn-primary px-6 disabled:opacity-50"
          >
            {loading ? '...' : 'ОК'}
          </button>
        </div>
        
        {message && (
          <p className={`mt-3 text-sm ${message.isError ? 'text-destructive' : 'text-primary'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Sign out button */}
      <button 
        onClick={onSignOut}
        className="w-full py-3 px-4 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors mt-auto"
      >
        Выйти из аккаунта
      </button>
    </section>
  );
}

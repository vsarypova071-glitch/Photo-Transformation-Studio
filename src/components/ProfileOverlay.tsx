import React from 'react';
import { User } from '../types';
 
 interface ProfileOverlayProps {
   user: User;
   onClose: () => void;
   onActivateVip: () => void;
 }
 
 export default function ProfileOverlay({ user, onClose, onActivateVip }: ProfileOverlayProps) {
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
       <button onClick={onActivateVip} className="btn-primary w-full">
         Пополнить (VIP 40 кр.)
       </button>
     </section>
   );
 }
import React from 'react';
import { User } from '../types';
 
 interface HeaderProps {
   user: User;
   visible: boolean;
   onProfileClick: () => void;
 }
 
 export default function Header({ user, visible, onProfileClick }: HeaderProps) {
   if (!visible) return null;
 
   return (
     <header className="fixed top-0 left-0 right-0 z-[60] glass px-6 py-4 flex justify-between items-center border-b border-white/5 max-w-md mx-auto">
       <div className="flex items-center gap-2.5">
         <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-black text-primary-foreground shadow-lg">
           AI
         </div>
         <h1 className="font-bold text-lg">Studio</h1>
       </div>
       <button 
         onClick={onProfileClick}
         className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-full text-[10px] font-bold border border-border active:scale-95"
       >
         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
         <span>{user.plan} • {user.remainingCredits}</span>
       </button>
     </header>
   );
 }
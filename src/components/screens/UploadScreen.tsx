import { useState } from 'react';
interface UploadScreenProps {
  onImageSelected: (base64: string) => void;
}
export default function UploadScreen({
  onImageSelected
}: UploadScreenProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = ev => {
        onImageSelected(ev.target?.result as string);
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };
  return <section className="min-h-screen flex items-center justify-center px-8 py-24 flex-col">
       <h2 className="text-3xl mb-3 uppercase tracking-tighter font-sans font-normal">Загрузите фото</h2>
       <p className="text-sm mb-12 text-center text-slate-50">
         AI создаст безупречный образ, идеально подходящий вашей фигуре.
       </p>
       <div className="w-full max-w-sm aspect-square relative rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center bg-secondary/40 cursor-pointer overflow-hidden group hover:border-primary transition-all">
         {!isProcessing ? <div className="flex flex-col items-center px-10 text-center">
             <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
               <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
             </div>
             <p className="text-lg font-bold text-foreground mb-2 uppercase">Выбрать селфи</p>
             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Лицо останется реальным</p>
           </div> : <div className="flex flex-col items-center">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent animate-spin rounded-full mb-4" />
             <p className="text-xs font-bold text-muted-foreground uppercase">Сжатие...</p>
           </div>}
         <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
       </div>
     </section>;
}
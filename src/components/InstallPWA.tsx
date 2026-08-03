import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const InstallPWA: React.FC<{ className?: string, showIconOnly?: boolean }> = ({ className = "", showIconOnly = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect if already in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Capture install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("Install prompt captured");
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  // If already installed, hide button
  if (isStandalone) return null;

  // If no prompt captured yet AND not iOS, hide button (unless in dev mode where we force it, but usually we hide)
  // For better UX, we only show if we can actually do something (Prompt or iOS instructions)
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <button 
        onClick={handleInstallClick}
        className={`flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all font-bold shadow-md active:scale-95 ${className} ${showIconOnly ? 'p-2 rounded-full' : 'px-4 py-2 rounded-xl'}`}
        title="Install App"
      >
        <Download className="h-4 w-4" />
        {!showIconOnly && <span>Install App</span>}
      </button>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowIOSInstructions(false)} />
          <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95 shadow-2xl">
             <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="text-lg font-bold text-slate-900">Install RiceMgr</h3>
                 <p className="text-xs text-slate-500">Install to your home screen</p>
               </div>
               <button onClick={() => setShowIOSInstructions(false)} className="p-1 bg-slate-100 rounded-full text-slate-500">
                 <X className="h-5 w-5" />
               </button>
             </div>
             
             <div className="space-y-4 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <ol className="space-y-3 list-decimal list-inside font-medium text-slate-800">
                   <li className="flex items-center gap-2">Tap the <Share className="h-4 w-4 text-blue-500" /> <strong>Share</strong> button.</li>
                   <li className="flex items-center gap-2">Scroll down & tap <PlusSquare className="h-4 w-4 text-slate-500" /> <strong>Add to Home Screen</strong>.</li>
                 </ol>
             </div>

             <button onClick={() => setShowIOSInstructions(false)} className="mt-6 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200">
               Got it
             </button>
          </div>
        </div>
      )}
    </>
  );
};

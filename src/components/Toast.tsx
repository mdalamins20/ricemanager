import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  show: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  show,
  type = 'success',
  message,
  onClose,
  duration = 4000
}) => {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onClose]);

  if (!show) return null;

  const typeConfig = {
    success: {
      bg: 'bg-emerald-600 dark:bg-emerald-700',
      border: 'border-emerald-500/50',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-200 shrink-0" />
    },
    error: {
      bg: 'bg-rose-600 dark:bg-rose-700',
      border: 'border-rose-500/50',
      icon: <AlertCircle className="h-5 w-5 text-rose-200 shrink-0" />
    },
    warning: {
      bg: 'bg-amber-600 dark:bg-amber-700',
      border: 'border-amber-500/50',
      icon: <AlertTriangle className="h-5 w-5 text-amber-200 shrink-0" />
    },
    info: {
      bg: 'bg-blue-600 dark:bg-blue-700',
      border: 'border-blue-500/50',
      icon: <Info className="h-5 w-5 text-blue-200 shrink-0" />
    }
  };

  const current = typeConfig[type];

  return (
    <div className="fixed bottom-6 right-6 z-[200] max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-white shadow-2xl ${current.bg} border ${current.border} backdrop-blur-md`}>
        {current.icon}
        <p className="text-xs sm:text-sm font-semibold leading-relaxed flex-1 select-none">
          {message}
        </p>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0 -mr-1"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white/80" />
        </button>
      </div>
    </div>
  );
};

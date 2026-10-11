import React from 'react';
import { AlertCircle, HelpCircle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'emerald' | 'rose' | 'amber';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'নিশ্চিত করুন',
  cancelText = 'বাতিল',
  variant = 'emerald',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const btnColors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
    rose: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20',
    amber: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
  };

  const iconColors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${iconColors[variant]}`}>
            {variant === 'rose' ? (
              <AlertCircle className="h-6 w-6" />
            ) : (
              <HelpCircle className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all active:scale-95 ${btnColors[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

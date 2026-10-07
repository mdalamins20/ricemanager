import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface MonthPickerProps {
  value: string; // e.g. 'yyyy-MM'
  onChange: (value: string) => void;
  className?: string;
  max?: string;
  min?: string;
}

export const MonthPicker: React.FC<MonthPickerProps> = ({
  value,
  onChange,
  className = '',
  max,
  min
}) => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const effectiveMax = max || currentMonth;

  const isNextDisabled = value >= effectiveMax;
  const isPrevDisabled = min ? value <= min : false;

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPrevDisabled) return;
    const [y, m] = value.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevStr = format(prevDate, 'yyyy-MM');
    if (!min || prevStr >= min) {
      onChange(prevStr);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isNextDisabled) return;
    const [y, m] = value.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextStr = format(nextDate, 'yyyy-MM');
    if (nextStr <= effectiveMax) {
      onChange(nextStr);
    }
  };

  return (
    <div className={`flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1.5 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all ${className}`}>
      <button 
        type="button"
        onClick={handlePrev}
        disabled={isPrevDisabled}
        className={`p-1 rounded-xl transition-all shrink-0 ${
          isPrevDisabled 
            ? 'opacity-25 cursor-not-allowed text-slate-300 dark:text-slate-600 pointer-events-none' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white active:scale-90 cursor-pointer'
        }`}
        title={isPrevDisabled ? "Cannot navigate earlier" : "Previous Month"}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5 px-1.5 flex-1 min-w-0">
        <Calendar className="h-4 w-4 text-emerald-500 shrink-0" />
        <input 
          type="month" 
          value={value} 
          max={effectiveMax}
          min={min}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              if (val > effectiveMax) {
                onChange(effectiveMax);
              } else if (min && val < min) {
                onChange(min);
              } else {
                onChange(val);
              }
            }
          }}
          className="bg-transparent outline-none text-xs sm:text-sm font-bold text-slate-800 dark:text-white cursor-pointer w-full min-w-[125px]"
        />
      </div>

      <button 
        type="button"
        onClick={handleNext}
        disabled={isNextDisabled}
        className={`p-1 rounded-xl transition-all shrink-0 ${
          isNextDisabled 
            ? 'opacity-25 cursor-not-allowed text-slate-300 dark:text-slate-600 pointer-events-none' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white active:scale-90 cursor-pointer'
        }`}
        title={isNextDisabled ? "Cannot navigate to future month" : "Next Month"}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

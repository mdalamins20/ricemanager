import React, { useMemo, useState } from 'react';
import { Member } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { 
  X, Calendar, SunMedium, MoonStar, 
  Utensils, Wallet, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useMeals, useDeposits, useSettings } from '../../contexts';
import { MonthPicker } from '../MonthPicker';
import { getMealRateForMonth, calculateMealCost, formatMealRate } from '../../utils/pricing';

interface MemberHistoryProps {
  member: Member;
  initialMonth?: string;
  onClose: () => void;
}

export const MemberHistory: React.FC<MemberHistoryProps> = ({ member, initialMonth, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || format(new Date(), 'yyyy-MM'));
  const [filterType, setFilterType] = useState<'all' | 'meals' | 'off'>('all');

  const { allMeals, loading: mealsLoading } = useMeals();
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const dataLoading = settingsLoading || mealsLoading || depositsLoading;

  const currentPrice = getMealRateForMonth(settings, selectedMonth);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(format(prevDate, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(format(nextDate, 'yyyy-MM'));
  };

  const historyData = useMemo(() => {
    if (dataLoading) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const startStr = format(startDate, 'yyyy-MM-dd');
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    // 1. Previous Balance (before this month)
    let prevDeposits = 0;
    let prevMealCost = 0;
    allDeposits.forEach(d => {
      if (d.memberId === member.id && d.date < startStr) {
        prevDeposits += d.amount;
      }
    });
    allMeals.forEach(mDoc => {
      if (mDoc.date < startStr) {
        const entry = mDoc.entries?.[member.id];
        if (entry) {
          const meals = (entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (Number(entry.guestLunch) || 0) + (Number(entry.guestDinner) || 0);
          const pastRate = getMealRateForMonth(settings, mDoc.date.slice(0, 7));
          prevMealCost += calculateMealCost(meals, pastRate);
        }
      }
    });
    const prevBalance = Math.round(prevDeposits - prevMealCost);

    // 2. Current Month Deposits
    let monthAdvance = 0;
    let monthFinal = 0;
    allDeposits.forEach(d => {
      if (d.memberId === member.id && d.date.startsWith(selectedMonth)) {
        if (d.type === 'final') monthFinal += d.amount;
        else monthAdvance += d.amount;
      }
    });
    const totalMonthDeposit = monthAdvance + monthFinal;

    // 3. Current Month Meals & Daily Logs
    let monthLunch = 0;
    let monthDinner = 0;
    let monthGuest = 0;
    let monthMealsCount = 0;

    const dailyData = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const mealDoc = allMeals.find(m => m.date === dateStr);
      let lunch = false;
      let dinner = false;
      let guestLunch = 0;
      let guestDinner = 0;

      if (mealDoc && mealDoc.entries?.[member.id]) {
        const entry = mealDoc.entries[member.id];
        lunch = Boolean(entry.lunch);
        dinner = Boolean(entry.dinner);
        guestLunch = Number(entry.guestLunch) || 0;
        guestDinner = Number(entry.guestDinner) || 0;
      }

      const guestTotal = guestLunch + guestDinner;
      const dailyTotal = (lunch ? 1 : 0) + (dinner ? 1 : 0) + guestTotal;

      if (lunch) monthLunch++;
      if (dinner) monthDinner++;
      monthGuest += guestTotal;
      monthMealsCount += dailyTotal;

      return {
        date: day,
        dateStr,
        lunch,
        dinner,
        guestLunch,
        guestDinner,
        guestTotal,
        dailyTotal,
        cost: calculateMealCost(dailyTotal, currentPrice)
      };
    });

    const monthTotalCost = calculateMealCost(monthMealsCount, currentPrice);
    const availableFunds = prevBalance + totalMonthDeposit;
    const monthClosingBalance = availableFunds - monthTotalCost;

    return {
      prevBalance,
      monthAdvance,
      monthFinal,
      totalMonthDeposit,
      monthLunch,
      monthDinner,
      monthGuest,
      monthMealsCount,
      monthTotalCost,
      monthClosingBalance,
      dailyData
    };
  }, [selectedMonth, member.id, allMeals, allDeposits, currentPrice, dataLoading]);

  // Filter daily list
  const filteredDays = useMemo(() => {
    if (!historyData) return [];
    if (filterType === 'meals') {
      return historyData.dailyData.filter(d => d.dailyTotal > 0);
    }
    if (filterType === 'off') {
      return historyData.dailyData.filter(d => d.dailyTotal === 0);
    }
    return historyData.dailyData;
  }, [historyData, filterType]);

  const activeDaysCount = useMemo(() => {
    return historyData?.dailyData.filter(d => d.dailyTotal > 0).length || 0;
  }, [historyData]);

  const offDaysCount = useMemo(() => {
    return historyData?.dailyData.filter(d => d.dailyTotal === 0).length || 0;
  }, [historyData]);

  const isDue = (historyData?.monthClosingBalance || 0) < 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-2xl lg:max-w-3xl bg-slate-100 dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Modal Top Header */}
        <div className="flex-none bg-white dark:bg-slate-900 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {/* Member Profile */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-black shadow-md shadow-emerald-500/10 overflow-hidden border-2 border-white dark:border-slate-800">
                {member.photoBase64 ? (
                  <img src={member.photoBase64} alt={member.fullName} className="h-full w-full object-cover" />
                ) : (
                  member.fullName.charAt(0)
                )}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {member.fullName}
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${member.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30'}`}>
                  {member.status}
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
            title="Close"
          >
            <X className="h-5 w-5 stroke-[2.5px]" />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="flex-none px-5 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Rate / Meal</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{formatMealRate(currentPrice)} BDT</span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar">
          {/* Main KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Meals */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Meals</span>
                <Utensils className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {historyData?.monthMealsCount || 0}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                L: {historyData?.monthLunch || 0} | D: {historyData?.monthDinner || 0}
                {(historyData?.monthGuest || 0) > 0 && ` | G: ${historyData?.monthGuest}`}
              </div>
            </div>

            {/* Total Cost */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Meal Cost</span>
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                ৳{(historyData?.monthTotalCost || 0).toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {(historyData?.monthMealsCount || 0)} × {formatMealRate(currentPrice)} BDT
              </div>
            </div>

            {/* Total Deposits */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Deposits</span>
                <Wallet className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                ৳{(historyData?.totalMonthDeposit || 0).toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Total Month Deposit
              </div>
            </div>

            {/* Net Closing Balance */}
            <div className={`p-3.5 rounded-2xl border shadow-sm relative overflow-hidden ${isDue ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {isDue ? 'Net Due' : 'Net Surplus'}
                </span>
                {isDue ? <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              <div className={`text-xl sm:text-2xl font-black ${isDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {historyData?.monthClosingBalance !== undefined && (historyData.monthClosingBalance >= 0 ? '+' : '')}
                ৳{(historyData?.monthClosingBalance || 0).toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                Prev: {historyData?.prevBalance || 0} ৳
              </div>
            </div>
          </div>

          {/* Daily Breakdown Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Daily Breakdown Log
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')} consumption history
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto shadow-sm">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                All ({historyData?.dailyData.length || 0})
              </button>
              <button
                onClick={() => setFilterType('meals')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'meals' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'}`}
              >
                Meals ({activeDaysCount})
              </button>
              <button
                onClick={() => setFilterType('off')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'off' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'}`}
              >
                Off ({offDaysCount})
              </button>
            </div>
          </div>

          {/* Daily List Items */}
          <div className="space-y-2 pb-2">
            {filteredDays.map(day => {
              const hasMeals = day.dailyTotal > 0;
              return (
                <div 
                  key={day.dateStr}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    hasMeals 
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-sm' 
                      : 'bg-slate-200/50 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                  }`}
                >
                  {/* Date & Weekday */}
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                      hasMeals 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 font-black' 
                        : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold'
                    }`}>
                      <span className="text-sm font-black leading-none">{format(day.date, 'dd')}</span>
                      <span className="text-[9px] uppercase tracking-wider leading-none mt-1 font-bold">{format(day.date, 'MMM')}</span>
                    </div>

                    <div>
                      <span className="text-sm font-black text-slate-900 dark:text-white block">
                        {format(day.date, 'EEEE')}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {hasMeals ? `${day.dailyTotal} meal${day.dailyTotal > 1 ? 's' : ''}` : 'No meal recorded'}
                      </span>
                    </div>
                  </div>

                  {/* Meal Badges (Lunch / Dinner / Guest) */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Lunch Badge */}
                    <div className="flex items-center gap-1">
                      <div 
                        className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition-colors ${
                          day.lunch 
                            ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300' 
                            : 'bg-slate-100 dark:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                        }`}
                        title={day.lunch ? 'Lunch eaten' : 'Lunch off'}
                      >
                        <SunMedium className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-black text-[11px]">L</span>
                      </div>
                      {day.guestLunch > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40" title={`${day.guestLunch} Guest Lunch`}>
                          +{day.guestLunch}G
                        </span>
                      )}
                    </div>

                    {/* Dinner Badge */}
                    <div className="flex items-center gap-1">
                      <div 
                        className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition-colors ${
                          day.dinner 
                            ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 text-blue-900 dark:text-blue-300' 
                            : 'bg-slate-100 dark:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                        }`}
                        title={day.dinner ? 'Dinner eaten' : 'Dinner off'}
                      >
                        <MoonStar className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-black text-[11px]">D</span>
                      </div>
                      {day.guestDinner > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40" title={`${day.guestDinner} Guest Dinner`}>
                          +{day.guestDinner}G
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Day Cost */}
                  <div className="text-right w-16 shrink-0">
                    <span className={`text-sm sm:text-base font-black ${hasMeals ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                      {hasMeals ? `৳${day.cost}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="flex-none bg-white dark:bg-slate-900 px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Month Meals: <strong className="text-slate-900 dark:text-white">{historyData?.monthMealsCount || 0}</strong></span>
            <span>•</span>
            <span>Total Bill: <strong className="text-rose-600 dark:text-rose-400">৳{(historyData?.monthTotalCost || 0).toLocaleString()}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

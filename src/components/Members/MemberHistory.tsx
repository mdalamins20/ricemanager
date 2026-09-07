import React, { useEffect, useState, useMemo } from 'react';
import { Member } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { X, Calendar, SunMedium, MoonStar } from 'lucide-react';
import { useMeals, useDeposits, useSettings } from '../../contexts';

export const MemberHistory: React.FC<{ member: Member; onClose: () => void }> = ({ member, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{
    days: { date: Date; lunch: boolean; dinner: boolean; guestLunch: number; guestDinner: number; cost: number }[];
    monthTotalMeals: number;
    monthTotalCost: number;
    monthDeposit: number;
    netBalance: number;
  }>({ days: [], monthTotalMeals: 0, monthTotalCost: 0, monthDeposit: 0, netBalance: 0 });
  
  const [mealPrice, setMealPrice] = useState(65);

  const { allMeals } = useMeals();
  const { allDeposits } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const { loading: mealsLoading } = useMeals();
  const dataLoading = settingsLoading || mealsLoading;

  const historyData = useMemo(() => {
    if (dataLoading) return null;
    const currentPrice = settings?.mealPrice || 65;

    const memberDeposits = allDeposits.filter(d => d.memberId === member.id);

    let totalLifetimeMeals = 0;
    let totalLifetimeDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);

    allMeals.forEach(m => {
      const entry = m.entries?.[member.id];
      if (entry) {
        if (entry.lunch) totalLifetimeMeals++;
        if (entry.dinner) totalLifetimeMeals++;
        if (entry.guestLunch) totalLifetimeMeals += entry.guestLunch;
        if (entry.guestDinner) totalLifetimeMeals += entry.guestDinner;
      }
    });
    
    const netBalance = totalLifetimeDeposit - (totalLifetimeMeals * currentPrice);

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    let monthMealsCount = 0;
    let monthDepositAmount = 0;

    memberDeposits.forEach(d => {
       if (d.date.startsWith(selectedMonth)) {
         monthDepositAmount += d.amount;
       }
    });

    const dailyData = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const mealDoc = allMeals.find(m => m.date === dateStr);
      let lunch = false;
      let dinner = false;
      let guestLunch = 0;
      let guestDinner = 0;

      if (mealDoc && mealDoc.entries?.[member.id]) {
        const entry = mealDoc.entries[member.id];
        lunch = entry.lunch;
        dinner = entry.dinner;
        guestLunch = entry.guestLunch || 0;
        guestDinner = entry.guestDinner || 0;
      }

      const dailyTotal = (lunch ? 1 : 0) + (dinner ? 1 : 0) + guestLunch + guestDinner;
      monthMealsCount += dailyTotal;

      return {
        date: day,
        lunch,
        dinner,
        guestLunch,
        guestDinner,
        cost: dailyTotal * currentPrice
      };
    });

    return {
      days: dailyData,
      monthTotalMeals: monthMealsCount,
      monthTotalCost: monthMealsCount * currentPrice,
      monthDeposit: monthDepositAmount,
      netBalance,
      mealPrice: currentPrice
    };
  }, [selectedMonth, member.id, allMeals, allDeposits, settings, dataLoading]);

  useEffect(() => {
    if (historyData) {
      setHistory({
        days: historyData.days,
        monthTotalMeals: historyData.monthTotalMeals,
        monthTotalCost: historyData.monthTotalCost,
        monthDeposit: historyData.monthDeposit,
        netBalance: historyData.netBalance
      });
      setMealPrice(historyData.mealPrice);
      setLoading(false);
    }
  }, [historyData]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 w-full h-[95vh] md:h-[90vh] md:max-w-4xl rounded-t-3xl md:rounded-3xl flex flex-col relative z-10 animate-in slide-in-from-bottom duration-300 shadow-2xl">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-3xl md:rounded-t-3xl">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold overflow-hidden shrink-0">
                {member.photoBase64 ? (
                   <img src={member.photoBase64} alt={member.fullName} className="h-full w-full object-cover" />
                ) : (
                   member.fullName.charAt(0)
                )}
             </div>
             <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white leading-tight">{member.fullName}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">{member.phone}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
            <X className="h-5 w-5 stroke-[2.5px]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-6">
             <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-slate-400" />
                   <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="outline-none text-slate-800 dark:text-white font-bold bg-transparent text-sm cursor-pointer"
                  />
                </div>
                <div className={`px-3 py-1 rounded-lg font-bold text-sm ${history.netBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500'}`}>
                   Net: {history.netBalance >= 0 ? '+' : ''}{history.netBalance} ৳
                </div>
             </div>

             {/* Stats Grid */}
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-900/40">
                  <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Total Meals</p>
                  <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{history.monthTotalMeals}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                   <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Cost</p>
                   <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">৳{history.monthTotalCost}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                   <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Deposit</p>
                   <div className="text-xl font-bold text-blue-700 dark:text-blue-400">৳{history.monthDeposit}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                   <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{member.status.toUpperCase()}</div>
                </div>
             </div>
          </div>

          {/* Daily List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daily Breakdown</h3>
            {history.days.map((day) => (
              <div key={day.date.toISOString()} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                 <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{format(day.date, 'dd MMM')}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{format(day.date, 'EEEE')}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    {/* Lunch */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${day.lunch ? 'bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'}`}>
                        <SunMedium className="h-3 w-3" />
                        </div>
                        {day.guestLunch > 0 && <span className="text-[8px] font-bold text-amber-600">G:{day.guestLunch}</span>}
                    </div>
                    {/* Dinner */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${day.dinner ? 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'}`}>
                        <MoonStar className="h-3 w-3" />
                        </div>
                        {day.guestDinner > 0 && <span className="text-[8px] font-bold text-emerald-600">G:{day.guestDinner}</span>}
                    </div>
                 </div>
                 <div className="text-sm font-bold text-slate-700 dark:text-slate-300 w-12 text-right">
                    ৳{day.cost}
                 </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

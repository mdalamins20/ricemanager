
import React, { useMemo, useState } from 'react';
import { UsersRound, UtensilsCrossed, Banknote, TrendingUp, TrendingDown, Receipt, ChefHat, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '../DataContext';

export const Dashboard: React.FC = () => {
  const { members, allMeals, allDeposits, settings } = useData();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const currentMonthName = format(new Date(selectedMonth), 'MMMM yyyy');
  const currentMonthPrefix = selectedMonth;

  const stats = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'active').length;
    const mealPrice = settings?.mealPrice || 65;
    
    let monthMealsCount = 0;
    allMeals.forEach(mDoc => {
      if (mDoc.date.startsWith(currentMonthPrefix)) {
        Object.values(mDoc.entries || {}).forEach(entry => {
          if (entry.lunch) monthMealsCount++;
          if (entry.dinner) monthMealsCount++;
          if (entry.guestLunch) monthMealsCount += entry.guestLunch;
          if (entry.guestDinner) monthMealsCount += entry.guestDinner;
        });
      }
    });

    let monthDepositAmount = 0;
    allDeposits.forEach(d => {
      if (d.date.startsWith(currentMonthPrefix)) {
        monthDepositAmount += d.amount;
      }
    });

    const monthBillAmount = monthMealsCount * mealPrice;
    const net = monthDepositAmount - monthBillAmount;

    return {
      activeMembers,
      monthMeals: monthMealsCount,
      monthBill: monthBillAmount,
      monthDeposit: monthDepositAmount,
      netBalance: net
    };
  }, [members, allMeals, allDeposits, settings, currentMonthPrefix]);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex-none flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">Overview</h2>
          <div className="mt-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="text-sm font-bold uppercase tracking-widest">{currentMonthName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all">
            <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white cursor-pointer" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 md:space-y-8 pb-10">
      {/* Hero Banner (Net Status) */}
      <div className={`relative overflow-hidden rounded-3xl p-8 md:p-10 shadow-2xl transition-all ${stats.netBalance >= 0 ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-900' : 'bg-gradient-to-br from-rose-500 via-red-600 to-rose-900'}`}>
         {/* Glassmorphism overlays & blobs */}
         <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
         <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-black/20 rounded-full blur-3xl"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-[0.2em] mb-2 drop-shadow-sm">Current Net Standing</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-md">
                       <span className="text-3xl md:text-5xl opacity-80 mr-1">৳</span>
                       {Math.abs(stats.netBalance).toLocaleString()}
                    </h3>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                    {stats.netBalance >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-200" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-rose-200" />
                    )}
                    <span className="text-sm font-bold text-white shadow-sm">
                        {stats.netBalance >= 0 ? 'Surplus Cash in Hand' : 'Pending Collections Required'}
                    </span>
                </div>
            </div>
            
            <div className="hidden md:flex h-32 w-32 rounded-full bg-white border-4 border-white/30 items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] overflow-hidden">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
         </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Active Members */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <UsersRound className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Total</span>
            </div>
            <div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{stats.activeMembers}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Members</p>
            </div>
        </div>

        {/* Monthly Meals */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-800/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <UtensilsCrossed className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Meals</span>
            </div>
            <div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{stats.monthMeals}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Consumed</p>
            </div>
        </div>

        {/* Collected */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <Banknote className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">In</span>
            </div>
            <div>
                <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1 tracking-tight">৳{stats.monthDeposit}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Collected</p>
            </div>
        </div>

        {/* Total Bill */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <Receipt className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Out</span>
            </div>
            <div>
                <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-1 tracking-tight">৳{stats.monthBill}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Bill</p>
            </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4">
        <button 
            onClick={() => window.location.hash = '#/meals'}
            className="group relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-6 md:p-8 rounded-3xl flex items-center justify-between text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/20 active:scale-[0.98] border border-slate-700/50"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                 Meal Entry <ChevronRight className="h-5 w-5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </h3>
              <p className="text-slate-400 text-sm font-medium">Record daily meals and manage guests effortlessly.</p>
            </div>
            <div className="relative z-10 h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-indigo-500 group-hover:rotate-12 transition-all duration-300 shadow-lg border border-white/10">
                <ChefHat className="h-7 w-7" />
            </div>
        </button>

        <button 
            onClick={() => window.location.hash = '#/money'}
            className="group relative overflow-hidden bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/10 active:scale-[0.98]"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                 Add Money <ChevronRight className="h-5 w-5 text-emerald-500 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Record payments, deposits, and settlements.</p>
            </div>
            <div className="relative z-10 h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:rotate-12 transition-all duration-300 shadow-sm border border-emerald-100 dark:border-emerald-800/50">
                <Banknote className="h-7 w-7" />
            </div>
        </button>
      </div>
      </div>
    </div>
  );
};

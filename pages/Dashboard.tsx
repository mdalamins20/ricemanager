
import React, { useMemo } from 'react';
import { UsersRound, UtensilsCrossed, Banknote, Wallet, TrendingUp, TrendingDown, Receipt, Calculator, ChefHat, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '../DataContext';

export const Dashboard: React.FC = () => {
  const { members, allMeals, allDeposits, settings } = useData();
  const now = new Date();
  const currentMonthName = format(now, 'MMMM yyyy');
  const currentMonthPrefix = format(now, 'yyyy-MM');

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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Overview</h2>
          <div className="mt-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-widest">{currentMonthName}</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Active Members */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <UsersRound className="h-5 w-5 stroke-[2px]" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Members</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.activeMembers}</h3>
            </div>
        </div>

        {/* Monthly Meals */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <UtensilsCrossed className="h-5 w-5 stroke-[2px]" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Meals</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.monthMeals}</h3>
            </div>
        </div>

        {/* Collected */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Banknote className="h-5 w-5 stroke-[2px]" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Collected</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{stats.monthDeposit}</h3>
            </div>
        </div>

        {/* Total Bill */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
                <Receipt className="h-5 w-5 stroke-[2px]" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Bill</p>
                <h3 className="text-2xl font-bold text-violet-600 dark:text-violet-400">৳{stats.monthBill}</h3>
            </div>
        </div>

        {/* Net Status Banner */}
        <div className={`col-span-2 lg:col-span-4 p-6 md:p-8 rounded-3xl border shadow-lg flex items-center justify-between relative overflow-hidden transition-all ${stats.netBalance >= 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500' : 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-500'}`}>
            <div className="relative z-10">
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] mb-1">Current Standing</p>
                <h3 className="text-4xl md:text-5xl font-black mb-1">
                   ৳{Math.abs(stats.netBalance).toLocaleString()}
                </h3>
                <p className="text-xs text-white/70 font-medium">
                    {stats.netBalance >= 0 ? 'Surplus Cash in Hand' : 'Pending Collections Required'}
                </p>
            </div>
            
            <div className="relative z-10 p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                {stats.netBalance >= 0 ? (
                    <Wallet className="h-8 w-8 text-white stroke-[1.5px]" />
                ) : (
                    <TrendingDown className="h-8 w-8 text-white stroke-[1.5px]" />
                )}
            </div>
            
            {/* Background Decoration */}
            <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <button 
            onClick={() => window.location.hash = '#/meals'}
            className="group bg-slate-900 dark:bg-slate-800 p-6 rounded-2xl relative overflow-hidden flex items-center justify-between text-left transition-all active:scale-[0.98] hover:shadow-lg"
        >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-1">Meal Entry</h3>
              <p className="text-slate-400 text-xs">Record daily meals for members</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:bg-red-600 transition-colors">
                <UtensilsCrossed className="h-5 w-5" />
            </div>
        </button>

        <button 
            onClick={() => window.location.hash = '#/money'}
            className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 relative overflow-hidden flex items-center justify-between text-left transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
        >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Add Money</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Record payments and deposits</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Banknote className="h-5 w-5" />
            </div>
        </button>
      </div>
    </div>
  );
};

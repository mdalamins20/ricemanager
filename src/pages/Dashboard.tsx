
import React, { useMemo, useState } from 'react';
import { MonthPicker } from '../components/MonthPicker';
import { UsersRound, UtensilsCrossed, Banknote, TrendingUp, TrendingDown, Receipt, ChefHat, Calendar, Sun, Moon, Clock, ArrowRightLeft, Sunrise, Sunset, Coffee, Wallet } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useMembers, useMeals, useDeposits, useSettings, useVendorPayments } from '../contexts';
import { getMealRateForMonth, calculateMealCost, formatMealRate } from '../utils/pricing';

export const Dashboard: React.FC = () => {
  const { members } = useMembers();
  const { allMeals } = useMeals();
  const { allDeposits } = useDeposits();
  const { vendorPayments } = useVendorPayments();
  const { settings } = useSettings();
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [yDash, mDash] = selectedMonth.split('-').map(Number);
  const currentMonthName = format(new Date(yDash, mDash - 1, 1), 'MMMM yyyy');

  // Greeting
  const { greeting, GreetingIcon } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: 'Good Morning', GreetingIcon: Sunrise };
    if (hour < 18) return { greeting: 'Good Afternoon', GreetingIcon: Sun };
    if (hour < 22) return { greeting: 'Good Evening', GreetingIcon: Sunset };
    return { greeting: 'Good Night', GreetingIcon: Moon };
  }, []);

  const stats = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'active').length;
    const mealPrice = getMealRateForMonth(settings, selectedMonth);
    
    // Monthly calculations
    let monthMealsCount = 0;
    allMeals.forEach(mDoc => {
      if (mDoc.date.startsWith(selectedMonth)) {
        Object.values(mDoc.entries || {}).forEach(entry => {
          if (entry.lunch) monthMealsCount++;
          if (entry.dinner) monthMealsCount++;
          if (entry.guestLunch) monthMealsCount += entry.guestLunch;
          if (entry.guestDinner) monthMealsCount += entry.guestDinner;
        });
      }
    });

    // Today's Meals
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayDoc = allMeals.find(m => m.date === todayStr);
    let todayLunch = 0;
    let todayDinner = 0;
    let todayGuest = 0;
    
    if (todayDoc) {
        Object.values(todayDoc.entries || {}).forEach(entry => {
            if (entry.lunch) todayLunch++;
            if (entry.dinner) todayDinner++;
            if (entry.guestLunch) todayGuest += entry.guestLunch;
            if (entry.guestDinner) todayGuest += entry.guestDinner;
        });
    }

    const monthDepositAmount = allDeposits
        .filter(d => d.date.startsWith(selectedMonth))
        .reduce((sum, d) => sum + d.amount, 0);

    const monthVendorPaid = vendorPayments
        .filter(vp => {
            const vpMonth = (vp as any).forMonth || vp.date.substring(0, 7);
            return vpMonth === selectedMonth;
        })
        .reduce((sum, vp) => sum + vp.amount, 0);

    const monthBillAmount = calculateMealCost(monthMealsCount, mealPrice);
    const netBalance = monthDepositAmount - monthBillAmount;
    const cashInHand = monthDepositAmount - monthVendorPaid;

    return {
      activeMembers,
      monthMeals: monthMealsCount,
      monthBill: monthBillAmount,
      monthDeposit: monthDepositAmount,
      monthVendorPaid,
      netBalance,
      cashInHand,
      mealPrice,
      todayLunch,
      todayDinner,
      todayGuest
    };
  }, [members, allMeals, allDeposits, vendorPayments, settings, selectedMonth]);

  // Recent Transactions (Last 5)
  const recentTransactions = useMemo(() => {
    const deposits = allDeposits.map(d => {
        const member = members.find(m => m.id === d.memberId);
        return {
            id: d.id,
            type: 'deposit',
            amount: d.amount,
            date: d.date,
            label: member ? `Deposit from ${member.fullName}` : 'Member Deposit',
            icon: TrendingUp,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
        };
    });
    
    const payments = vendorPayments.map(vp => ({
        id: vp.id,
        type: 'payment',
        amount: vp.amount,
        date: vp.date,
        label: `Paid to Food Vendor`,
        icon: TrendingDown,
        color: 'text-rose-500',
        bgColor: 'bg-rose-50 dark:bg-rose-900/20'
    }));

    return [...deposits, ...payments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
  }, [allDeposits, vendorPayments, members]);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-700">
      
      {/* Premium Header */}
      <div className="flex-none flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 sm:py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div className="flex flex-col gap-0.5 sm:gap-1">
            <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-500 dark:text-emerald-400 font-bold text-xs sm:text-sm tracking-widest uppercase">
                <GreetingIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {greeting}, Admin!
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto mt-1 md:mt-0">
           <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm shrink-0">
               <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Meal Rate</span>
               <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">৳{formatMealRate(stats.mealPrice)}</span>
           </div>
           <MonthPicker value={selectedMonth} onChange={setSelectedMonth} className="flex-1 md:flex-auto" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 md:space-y-8 pb-10">
      
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Overview (Hero) */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-3xl md:rounded-[2rem] p-5 sm:p-7 md:p-8 shadow-2xl text-white flex flex-col justify-between group transition-colors duration-500 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900">
                 <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mt-32 -mr-32 transition-transform duration-1000 group-hover:scale-125"></div>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl -mb-20 -ml-20"></div>

                 <div className="relative z-10 flex items-start justify-between gap-3 mb-6 sm:mb-8">
                    <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                       <p className="text-[11px] sm:text-xs font-black text-white/70 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                           <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Current Net Standing
                       </p>
                       <div className="flex items-baseline gap-1.5 sm:gap-2">
                           <span className="text-2xl sm:text-3xl opacity-60 font-medium">৳</span>
                           <h3 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter drop-shadow-lg truncate">
                              {Math.abs(stats.netBalance).toLocaleString()}
                           </h3>
                       </div>
                       <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-sm max-w-full">
                           {stats.netBalance >= 0 ? (
                               <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-100 shrink-0" />
                           ) : (
                               <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-200 shrink-0" />
                           )}
                           <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
                               {stats.netBalance >= 0 ? 'Surplus Cash in Hand' : 'Pending Collections Required'}
                           </span>
                       </div>
                    </div>

                    {/* Logo - cleanly sized and never overlapping */}
                    <div className="shrink-0 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                       <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36 lg:w-44 lg:h-44 bg-white rounded-full p-1 sm:p-1.5 md:p-2 shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex items-center justify-center overflow-hidden">
                          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain scale-110" />
                       </div>
                    </div>
                 </div>

                 <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4 border-t border-white/20 pt-4 sm:pt-6">
                    <div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5 sm:mb-1">Total Collected</p>
                        <p className="text-xl sm:text-2xl font-black">৳{stats.monthDeposit.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5 sm:mb-1">Total Bill</p>
                        <p className="text-xl sm:text-2xl font-black">৳{stats.monthBill.toLocaleString()}</p>
                    </div>
                 </div>
              </div>

              {/* Today's Meal Status */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl md:rounded-[2rem] p-5 sm:p-6 md:p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                 <div>
                     <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" /> Today's Meals
                        </h3>
                        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 sm:py-1 rounded-lg uppercase tracking-wider">Live</span>
                     </div>
                     
                     <div className="space-y-3 sm:space-y-4">
                         <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center shrink-0">
                                     <Sun className="h-5 w-5 text-orange-500" />
                                 </div>
                                 <div>
                                     <p className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Lunch</p>
                                     <p className="text-xs font-medium text-slate-500">Active Eaters</p>
                                 </div>
                             </div>
                             <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{stats.todayLunch}</span>
                         </div>

                         <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center shrink-0">
                                     <Moon className="h-5 w-5 text-emerald-500" />
                                 </div>
                                 <div>
                                     <p className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Dinner</p>
                                     <p className="text-xs font-medium text-slate-500">Active Eaters</p>
                                 </div>
                             </div>
                             <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{stats.todayDinner}</span>
                         </div>
                     </div>
                 </div>

                 <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                     <div>
                         <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Guests Today</p>
                         <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2">
                             <UsersRound className="h-4 w-4 text-slate-400" /> {stats.todayGuest} Guests
                         </p>
                     </div>
                 </div>
              </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <UsersRound className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">{stats.activeMembers}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Active Members</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">{stats.monthMeals}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Consumed</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <Banknote className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">৳{stats.monthDeposit.toLocaleString()}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Collected</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <Receipt className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">৳{stats.monthBill.toLocaleString()}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bill</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">৳{stats.monthVendorPaid.toLocaleString()}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Paid to Vendor</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">৳{stats.cashInHand.toLocaleString()}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Cash in Hand</p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
             <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
                 <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                     <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
                 </div>
                 <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Recent Transactions</h3>
             </div>
             
             {recentTransactions.length === 0 ? (
                 <div className="p-12 text-center text-slate-500">
                     <Coffee className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                     <p className="font-bold">No transactions found</p>
                 </div>
             ) : (
                 <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                     {recentTransactions.map((tx, idx) => (
                         <div key={`${tx.id}-${idx}`} className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <div className="flex items-center gap-4">
                                 <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${tx.bgColor}`}>
                                     <tx.icon className={`h-5 w-5 ${tx.color}`} />
                                 </div>
                                 <div>
                                     <p className="font-bold text-slate-800 dark:text-white text-sm md:text-base">{tx.label}</p>
                                     <p className="text-xs font-medium text-slate-500">{format(new Date(tx.date), 'MMMM dd, yyyy')}</p>
                                 </div>
                             </div>
                             <div className={`text-lg md:text-xl font-black tracking-tight ${tx.color}`}>
                                 {tx.type === 'deposit' ? '+' : '-'}৳{tx.amount.toLocaleString()}
                             </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>

      </div>
    </div>
  );
};

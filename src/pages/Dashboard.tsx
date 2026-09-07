
import React, { useMemo, useState } from 'react';
import { UsersRound, UtensilsCrossed, Banknote, TrendingUp, TrendingDown, Receipt, ChefHat, Calendar, Sun, Moon, Clock, ArrowRightLeft, Sunrise, Sunset, Coffee, Wallet } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useMembers, useMeals, useDeposits, useSettings, useVendorPayments } from '../contexts';

export const Dashboard: React.FC = () => {
  const { members } = useMembers();
  const { allMeals } = useMeals();
  const { allDeposits } = useDeposits();
  const { vendorPayments } = useVendorPayments();
  const { settings } = useSettings();
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const currentMonthName = format(new Date(selectedMonth), 'MMMM yyyy');

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
    const mealPrice = settings?.mealPrice || 65;
    
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

    const monthBillAmount = monthMealsCount * mealPrice;
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
      <div className="flex-none flex flex-col md:flex-row md:items-end justify-between gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400 font-bold text-sm tracking-widest uppercase">
                <GreetingIcon className="h-5 w-5" />
                {greeting}, Admin!
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
           <div className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Meal Rate</span>
               <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">৳{settings?.mealPrice || 65}</span>
           </div>
           <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex-1 md:flex-auto">
               <Calendar className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
               <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white cursor-pointer w-full" />
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 md:space-y-8 pb-10">
      
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Overview (Hero) */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] p-8 shadow-2xl text-white flex flex-col justify-between group transition-colors duration-500 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900">
                 <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mt-32 -mr-32 transition-transform duration-1000 group-hover:scale-125"></div>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl -mb-20 -ml-20"></div>

                 {/* Large Logo */}
                 <div className="absolute top-6 right-6 md:top-8 md:right-10 transform group-hover:scale-105 transition-transform duration-700 pointer-events-none flex items-center justify-center z-0">
                    <div className="w-36 h-36 sm:w-56 sm:h-56 bg-white rounded-full p-1.5 sm:p-2 shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex items-center justify-center overflow-hidden">
                       <img src="/logo.png" alt="Logo" className="w-full h-full object-contain scale-110" />
                    </div>
                 </div>
                 
                 <div className="relative z-10 mb-8">
                    <p className="text-xs font-black text-white/70 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Banknote className="h-4 w-4" /> Current Net Standing
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl opacity-60 font-medium">৳</span>
                        <h3 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-lg">
                           {Math.abs(stats.netBalance).toLocaleString()}
                        </h3>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-sm">
                        {stats.netBalance >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-100" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-rose-200" />
                        )}
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {stats.netBalance >= 0 ? 'Surplus Cash in Hand' : 'Pending Collections Required'}
                        </span>
                    </div>
                 </div>

                 <div className="relative z-10 grid grid-cols-2 gap-4 border-t border-white/20 pt-6">
                    <div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Total Collected</p>
                        <p className="text-2xl font-black">৳{stats.monthDeposit.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Total Bill</p>
                        <p className="text-2xl font-black">৳{stats.monthBill.toLocaleString()}</p>
                    </div>
                 </div>
              </div>

              {/* Today's Meal Status */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                 <div>
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" /> Today's Meals
                        </h3>
                        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg uppercase tracking-wider">Live</span>
                     </div>
                     
                     <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                                     <Sun className="h-5 w-5 text-orange-500" />
                                 </div>
                                 <div>
                                     <p className="font-bold text-slate-800 dark:text-white">Lunch</p>
                                     <p className="text-xs font-medium text-slate-500">Active Eaters</p>
                                 </div>
                             </div>
                             <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.todayLunch}</span>
                         </div>

                         <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                                     <Moon className="h-5 w-5 text-emerald-500" />
                                 </div>
                                 <div>
                                     <p className="font-bold text-slate-800 dark:text-white">Dinner</p>
                                     <p className="text-xs font-medium text-slate-500">Active Eaters</p>
                                 </div>
                             </div>
                             <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.todayDinner}</span>
                         </div>
                     </div>
                 </div>

                 <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                     <div>
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Guests Today</p>
                         <p className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                             <UsersRound className="h-4 w-4 text-slate-400" /> {stats.todayGuest} Guests
                         </p>
                     </div>
                 </div>
              </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                    <UsersRound className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{stats.activeMembers}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Members</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                    <UtensilsCrossed className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{stats.monthMeals}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Consumed</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                    <Banknote className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">৳{stats.monthDeposit.toLocaleString()}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Collected</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 mb-4 group-hover:scale-110 transition-transform">
                    <Receipt className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">৳{stats.monthBill.toLocaleString()}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bill</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500 mb-4 group-hover:scale-110 transition-transform">
                    <ChefHat className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">৳{stats.monthVendorPaid.toLocaleString()}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid to Vendor</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col group hover:-translate-y-1 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                    <Wallet className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">৳{stats.cashInHand.toLocaleString()}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash in Hand</p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
                 <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                     <ArrowRightLeft className="h-5 w-5 text-slate-500" />
                 </div>
                 <h3 className="font-bold text-lg text-slate-800 dark:text-white">Recent Transactions</h3>
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

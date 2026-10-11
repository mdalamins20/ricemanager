
import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { Button } from '../components/Button';
import { WalletCards, Plus, Trash2, Calendar, User as UserIcon, Lock, ArrowDownLeft, AlertTriangle, X, Banknote, UsersRound, Utensils } from 'lucide-react';
import { Member, Deposit } from '../types';
import { format } from 'date-fns';
import { logAction } from '../utils/logger';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';
import { MonthPicker } from '../components/MonthPicker';
import { getMealRateForMonth, calculateMealCost, formatMealRate } from '../utils/pricing';
import { formatWhatsAppPhone } from '../utils/phone';
import { Toast } from '../components/Toast';
import { getWhatsAppApiUrl, getApiHeaders } from '../utils/apiConfig';

export const Money: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ show: true, type, message });
  };
  
  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    deposit: (Deposit & { memberName: string }) | null;
  }>({ isOpen: false, deposit: null });
  
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    targetMonth: format(new Date(), 'yyyy-MM'),
    type: 'advance' as 'advance' | 'final',
    note: ''
  });

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { members, loading: membersLoading } = useMembers();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const dataLoading = membersLoading || mealsLoading || depositsLoading || settingsLoading;

  const selectedMemberStats = useMemo(() => {
      if (!formData.memberId) return null;
      const targetMonth = formData.targetMonth || selectedMonth;
      const price = getMealRateForMonth(settings, targetMonth);
      const startStr = `${targetMonth}-01`;

      // Previous Balance (before selected target month)
      let prevTotalDeposit = 0, prevMealCost = 0;
      allDeposits.forEach(d => { 
        if (d.memberId === formData.memberId && d.date < startStr) {
          prevTotalDeposit += d.amount; 
        }
      });
      allMeals.forEach(mDoc => {
         if (mDoc.date < startStr) {
            const entry = mDoc.entries?.[formData.memberId];
            if (entry) { 
              let docMeals = 0;
              if (entry.lunch) docMeals++; 
              if (entry.dinner) docMeals++; 
              docMeals += Number(entry.guestLunch) || 0;
              docMeals += Number(entry.guestDinner) || 0;
              const docRate = getMealRateForMonth(settings, mDoc.date.slice(0, 7));
              prevMealCost += calculateMealCost(docMeals, docRate);
            }
         }
      });
      const prevBalance = Math.round(prevTotalDeposit - prevMealCost);

      // Selected Target Month Deposits
      let monthDeposit = 0, advanceDeposit = 0, finalDeposit = 0;
      allDeposits.forEach(d => { 
          if (d.memberId === formData.memberId && d.date.startsWith(targetMonth)) {
              if (d.type === 'final') finalDeposit += d.amount;
              else advanceDeposit += d.amount;
              monthDeposit += d.amount;
          } 
      });

      // Selected Target Month Meals
      let monthMeals = 0, lunchCount = 0, dinnerCount = 0, guestLunchCount = 0, guestDinnerCount = 0;
      allMeals.forEach(mDoc => {
         if (mDoc.date.startsWith(targetMonth)) {
            const entry = mDoc.entries?.[formData.memberId];
            if (entry) { 
              if (entry.lunch) { monthMeals++; lunchCount++; }
              if (entry.dinner) { monthMeals++; dinnerCount++; }
              const gL = Number(entry.guestLunch) || 0;
              const gD = Number(entry.guestDinner) || 0;
              monthMeals += gL;
              guestLunchCount += gL;
              monthMeals += gD;
              guestDinnerCount += gD;
            }
         }
      });

      const monthBill = calculateMealCost(monthMeals, price);
      const currentBalance = (prevBalance + monthDeposit) - monthBill;

      let formattedMonth = targetMonth;
      try {
        const [y, m] = targetMonth.split('-');
        formattedMonth = format(new Date(parseInt(y), parseInt(m) - 1, 1), 'MMMM yyyy');
      } catch (err) {}

      return {
          targetMonth,
          formattedMonth,
          price,
          prevBalance,
          advanceDeposit,
          finalDeposit,
          monthDeposit,
          monthMeals,
          lunchCount,
          dinnerCount,
          guestMealCount: guestLunchCount + guestDinnerCount,
          monthBill,
          currentBalance
      };
  }, [formData.memberId, formData.targetMonth, selectedMonth, allMeals, allDeposits, settings]);

  const deposits = useMemo(() => {
    return allDeposits
      .map(d => {
        const member = members.find(m => m.id === d.memberId);
        return { ...d, memberName: member ? member.fullName : 'Unknown', photoBase64: member?.photoBase64 };
      })
      .sort((a, b) => {
        const getStr = (v: any) => typeof v === 'string' ? v : (v?.seconds ? new Date(v.seconds * 1000).toISOString() : '');
        const dateA = getStr(a.createdAt) || a.date || '';
        const dateB = getStr(b.createdAt) || b.date || '';
        return dateB.localeCompare(dateA);
      });
  }, [allDeposits, members]);

  useEffect(() => {
    const authUnsub = auth.onAuthStateChanged((currentUser) => setUser(currentUser));
    return () => authUnsub();
  }, []);

  useEffect(() => {
    if (!dataLoading && members.length > 0 && !formData.memberId) {
      const activeMembers = members.filter(m => m.status === 'active');
      if (activeMembers.length > 0) {
        setFormData(prev => ({ ...prev, memberId: activeMembers[0].id }));
      }
    }
  }, [dataLoading, members, formData.memberId]);

  const activeMembersList = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  
  // Combine loading states
  const loading = dataLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.memberId || !formData.amount) return;
    
    const depositAmount = Number(formData.amount);
    const memberId = formData.memberId;
    const targetMonth = formData.targetMonth;
    const depositType = formData.type;
    const depositNote = formData.note || '';

    const member = members.find(m => m.id === memberId);
    const memberName = member?.fullName || 'Unknown';
    const memberPhone = formatWhatsAppPhone(member?.phone);
    const updatedBalance = (selectedMemberStats?.currentBalance || 0) + depositAmount;

    try {
      await db.collection('deposits').add({
        memberId,
        amount: depositAmount,
        date: `${targetMonth}-01`,
        note: depositNote,
        type: depositType,
        createdAt: new Date().toISOString()
      });

      // Immediate modal close and form reset so UI never gets stuck
      setIsModalOpen(false);
      setFormData(prev => ({ ...prev, amount: '', note: '', type: 'advance' }));
      showToast('success', `✅ ${memberName}-এর ৳${depositAmount} জমা সংরক্ষণ করা হয়েছে!`);

      // Non-blocking log action
      logAction('Add Deposit', `Added ${depositAmount} BDT (${depositType}) for ${memberName}`).catch(console.error);

      // Non-blocking WhatsApp deposit confirmation via bot
      if (memberPhone) {
        const apiBase = getWhatsAppApiUrl(settings);
        fetch(`${apiBase}/api/deposit-confirmation`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            memberName: memberName,
            phone: memberPhone,
            amount: depositAmount,
            currentBalance: updatedBalance,
            depositMonth: targetMonth
          })
        }).catch((err) => {
          console.log('[WhatsApp Bot] Offline or error:', err);
        });
      }
    } catch (error) {
      console.error('Error saving deposit:', error);
      showToast('error', 'জমা সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const initiateDelete = (deposit: Deposit & { memberName: string }) => {
    if (!user) return;
    setDeleteModal({ isOpen: true, deposit });
  };

  const confirmDelete = async () => {
    if (!deleteModal.deposit) return;
    const dep = deleteModal.deposit;
    try {
      await db.collection('deposits').doc(dep.id).delete();
      setDeleteModal({ isOpen: false, deposit: null });
      showToast('success', `জমা রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
      logAction('Delete Deposit', `Removed deposit of ${dep.amount} BDT for ${dep.memberName}`).catch(console.error);
    } catch(err) {
      console.error('Error deleting deposit:', err);
      showToast('error', 'জমা মুছতে সমস্যা হয়েছে।');
    }
  };

  const selectedMonthRate = getMealRateForMonth(settings, selectedMonth);
  const filteredDeposits = deposits.filter(deposit => deposit.date.startsWith(selectedMonth));

  const monthTotal = filteredDeposits.reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const monthAdvance = filteredDeposits.filter((d: any) => !d.type || d.type === 'advance').reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const monthFinal = filteredDeposits.filter((d: any) => d.type === 'final').reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const uniqueMembersPaid = new Set(filteredDeposits.map((d: any) => d.memberId)).size;

  const trueNetBalance = useMemo(() => {
      const [year, month] = selectedMonth.split('-');
      // Start of NEXT month (to include all days of selectedMonth)
      const nextMonthStr = format(new Date(parseInt(year), parseInt(month), 1), 'yyyy-MM-dd');
      
      let totalDeposit = 0;
      allDeposits.forEach(d => {
          if (d.date < nextMonthStr) {
              totalDeposit += d.amount;
          }
      });
      
      let totalMealCost = 0;
      allMeals.forEach(mDoc => {
          if (mDoc.date < nextMonthStr) {
              let docMeals = 0;
              Object.values(mDoc.entries || {}).forEach(entry => {
                  if (entry.lunch) docMeals++;
                  if (entry.dinner) docMeals++;
                  docMeals += Number(entry.guestLunch) || 0;
                  docMeals += Number(entry.guestDinner) || 0;
              });
              const docRate = getMealRateForMonth(settings, mDoc.date.slice(0, 7));
              totalMealCost += calculateMealCost(docMeals, docRate);
          }
      });
      
      return Math.round(totalDeposit - totalMealCost);
  }, [allMeals, allDeposits, selectedMonth, settings]);



  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Deposits</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manage Member Payments</p>
        </div>
        <div className="flex items-center gap-3">
           <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          {user && (
            <Button onClick={() => {
              setFormData(prev => ({ ...prev, targetMonth: selectedMonth }));
              setIsModalOpen(true);
            }} className="shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-2xl transition-transform hover:scale-105">
              <Plus className="h-5 w-5 stroke-[2.5px]" /> <span className="font-bold">Add</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-6 md:space-y-8">
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 sm:h-24 sm:w-24 bg-white/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-2 sm:mb-4">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-xl sm:text-3xl font-black mb-0.5 sm:mb-1 tracking-tight">৳{monthTotal.toLocaleString()}</h3>
                      <p className="text-[10px] sm:text-xs font-bold text-emerald-100 uppercase tracking-wider">Month Deposit</p>
                  </div>
              </div>
          </div>
          
          {/* Current Balance Card */}
          <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg text-white relative overflow-hidden group ${trueNetBalance >= 0 ? 'bg-gradient-to-br from-teal-600 to-emerald-700 shadow-emerald-500/20' : 'bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/20'}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 sm:h-24 sm:w-24 bg-white/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-2 sm:mb-4">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          {trueNetBalance >= 0 ? <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                      </div>
                  </div>
                  <div>
                      <h3 className="text-xl sm:text-3xl font-black mb-0.5 sm:mb-1 tracking-tight">
                          {trueNetBalance >= 0 ? '+' : ''}৳{trueNetBalance.toLocaleString()}
                      </h3>
                      <p className="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">Net Balance</p>
                  </div>
              </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all">
             <div className="flex flex-col h-full justify-between">
                 <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2 sm:mb-4">
                     <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
                 </div>
                 <div>
                     <h3 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">৳{formatMealRate(selectedMonthRate)}</h3>
                     <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Meal Rate</p>
                 </div>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all">
             <div className="flex sm:flex-col items-center sm:items-start justify-between h-full">
                 <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-0 sm:mb-4">
                     <UsersRound className="h-4 w-4 sm:h-5 sm:w-5" />
                 </div>
                 <div className="text-right sm:text-left">
                     <h3 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white mb-0.5 sm:mb-1">{uniqueMembersPaid}</h3>
                     <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Members Paid</p>
                 </div>
             </div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-500" /> Recent Transactions
              </h3>
          </div>
          {/* Desktop Table */}
          <table className="hidden md:table w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Month / Paid On</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Member</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Note</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No deposits found for this month.
                  </td>
                </tr>
              ) : (
                filteredDeposits.map(deposit => (
                  <tr key={deposit.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{format(new Date(deposit.date), 'MMM yyyy')}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Paid: {format(new Date(deposit.createdAt || deposit.date), 'dd MMM')}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden shrink-0">
                                {(deposit as any).photoBase64 ? (
                                    <img src={(deposit as any).photoBase64} alt={deposit.memberName} className="h-full w-full object-cover" />
                                ) : (
                                    deposit.memberName.charAt(0)
                                )}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{deposit.memberName}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+৳{deposit.amount}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Deposit</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-500">{deposit.note}</td>
                    <td className="px-6 py-4 text-right">{user && <button onClick={() => initiateDelete(deposit)} className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors"><Trash2 className="h-4 w-4 text-slate-400 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400" /></button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Native Wallet List View */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
             {filteredDeposits.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Banknote className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">No deposits found for this month</p>
                    <p className="text-xs text-slate-400 mt-0.5">Tap + Add above to record a member deposit</p>
                </div>
             ) : (
               filteredDeposits.map(deposit => (
                 <div key={deposit.id} className="p-3.5 sm:p-4 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700/30 transition-colors gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                       <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-emerald-100 dark:border-emerald-800/40">
                          {(deposit as any).photoBase64 ? (
                              <img src={(deposit as any).photoBase64} alt={deposit.memberName} className="h-full w-full object-cover" />
                          ) : (
                              <span>{deposit.memberName.charAt(0)}</span>
                          )}
                       </div>
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                             <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{deposit.memberName}</h4>
                             <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Deposit</span>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                              {format(new Date(deposit.date), 'MMM yyyy')} • {format(new Date(deposit.createdAt || deposit.date), 'dd MMM')}
                          </p>
                          {deposit.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 inline-block px-1.5 py-0.5 rounded mt-0.5 truncate max-w-full font-medium">{deposit.note}</p>}
                       </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <span className="font-black text-emerald-600 dark:text-emerald-400 text-base tracking-tight">+৳{deposit.amount}</span>
                       {user && (
                         <button onClick={() => initiateDelete(deposit)} className="p-2 -mr-1 text-slate-400 hover:text-red-500 active:scale-90 transition-transform">
                            <Trash2 className="h-4 w-4" />
                         </button>
                       )}
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

      {/* Add Modal - Native mobile bottom sheet / desktop centered */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-3xl w-full max-w-md relative z-10 p-5 sm:p-6 animate-in slide-in-from-bottom-6 sm:zoom-in-95 border-t sm:border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto pb-safe">
             {/* Mobile drag handle */}
             <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>
             <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add Deposit</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                   <X className="h-5 w-5" />
                </button>
             </div>
             <form onSubmit={handleSubmit} className="space-y-4">
               <select value={formData.memberId} onChange={e => setFormData({...formData, memberId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white">
                 {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
               </select>

               {selectedMemberStats && (
                   <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl text-sm border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                       <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                           <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                               Month: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedMemberStats.formattedMonth}</span>
                           </span>
                           <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300">
                               ৳{formatMealRate(selectedMemberStats.price)}/meal
                           </span>
                       </div>

                       <div className="space-y-1.5 text-xs">
                           <div className="flex justify-between items-center">
                               <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                   Previous Balance
                                   <span className="text-[10px] text-slate-400 font-medium">({selectedMemberStats.prevBalance < 0 ? 'Due' : 'Advance'})</span>
                               </span>
                               <span className={`font-bold ${selectedMemberStats.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                   {selectedMemberStats.prevBalance >= 0 ? '+' : ''}৳{selectedMemberStats.prevBalance}
                               </span>
                           </div>

                           <div className="flex justify-between items-center">
                               <span className="text-slate-500 dark:text-slate-400">Total Deposit ({selectedMemberStats.formattedMonth})</span>
                               <span className="font-bold text-slate-700 dark:text-slate-300">৳{selectedMemberStats.monthDeposit}</span>
                           </div>

                           <div className="flex justify-between items-center">
                               <span className="text-slate-500 dark:text-slate-400">Total Bill ({selectedMemberStats.monthMeals} Meals)</span>
                               <span className="font-bold text-slate-700 dark:text-slate-300">৳{selectedMemberStats.monthBill}</span>
                           </div>

                           {selectedMemberStats.monthMeals > 0 && (
                               <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-2 pt-0.5">
                                   <span>Lunch: {selectedMemberStats.lunchCount}</span>
                                   <span>•</span>
                                   <span>Dinner: {selectedMemberStats.dinnerCount}</span>
                                   {selectedMemberStats.guestMealCount > 0 && (
                                       <>
                                           <span>•</span>
                                           <span>Guest: {selectedMemberStats.guestMealCount}</span>
                                       </>
                                   )}
                               </div>
                           )}
                       </div>

                       <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2.5 mt-1">
                           <div>
                               <span className="text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[11px] tracking-wider block">Current Balance</span>
                               <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                   {selectedMemberStats.currentBalance < 0 ? 'Outstanding Due' : 'Advance Balance'}
                               </span>
                           </div>
                           <span className={`font-black text-xl ${selectedMemberStats.currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>
                               {selectedMemberStats.currentBalance >= 0 ? '+' : ''}৳{selectedMemberStats.currentBalance}
                           </span>
                       </div>
                   </div>
               )}
               <input type="number" required placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
                <div className="flex flex-col">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Deposit For Month</label>
                   <input 
                      type="month" 
                      required 
                      max={format(new Date(), 'yyyy-MM')}
                      value={formData.targetMonth} 
                      onChange={e => {
                        const curMonth = format(new Date(), 'yyyy-MM');
                        setFormData({...formData, targetMonth: e.target.value > curMonth ? curMonth : e.target.value});
                      }} 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" 
                    />
                </div>
               <input type="text" placeholder="Note (Optional)" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
               <Button type="submit" className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">Save</Button>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.deposit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, deposit: null })} />
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Transaction?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Permanently remove deposit of <span className="font-bold text-slate-800 dark:text-slate-200">৳{deleteModal.deposit.amount}</span> from <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModal.deposit.memberName}</span>?
                        </p>
                    </div>
                    
                    <div className="flex gap-3 w-full mt-2">
                        <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, deposit: null })} className="flex-1 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={confirmDelete} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
                            Delete
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* In-app Toast Notification */}
      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

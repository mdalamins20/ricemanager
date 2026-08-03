
import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { Button } from '../components/Button';
import { WalletCards, Plus, Trash2, Calendar, User as UserIcon, Lock, ArrowDownLeft, AlertTriangle, X, Banknote, UsersRound } from 'lucide-react';
import { Member, Deposit } from '../types';
import { format } from 'date-fns';
import { logAction } from '../utils/logger';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';

export const Money: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);
  
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
      const price = settings?.mealPrice || 65;
      
      let totalMeals = 0;
      allMeals.forEach(mDoc => {
          const entry = mDoc.entries?.[formData.memberId];
          if (entry) {
              if (entry.lunch) totalMeals++;
              if (entry.dinner) totalMeals++;
              if (entry.guestLunch) totalMeals += entry.guestLunch;
              if (entry.guestDinner) totalMeals += entry.guestDinner;
          }
      });

      let totalDeposit = 0;
      allDeposits.forEach(d => {
          if (d.memberId === formData.memberId) {
              totalDeposit += d.amount;
          }
      });

      const totalBill = totalMeals * price;
      const netBalance = totalDeposit - totalBill;

      return {
          totalMeals,
          totalDeposit,
          totalBill,
          netBalance
      };
  }, [formData.memberId, allMeals, allDeposits, settings]);

  const deposits = useMemo(() => {
    return allDeposits
      .map(d => {
        const member = members.find(m => m.id === d.memberId);
        return { ...d, memberName: member ? member.fullName : 'Unknown', photoBase64: member?.photoBase64 };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
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
    try {
      await db.collection('deposits').add({
        memberId: formData.memberId, amount: Number(formData.amount), date: `${formData.targetMonth}-01`, note: formData.note, type: formData.type, createdAt: new Date().toISOString()
      });
      const memberName = members.find(m => m.id === formData.memberId)?.fullName || 'Unknown';
      await logAction('Add Deposit', `Added ${formData.amount} BDT (${formData.type}) for ${memberName}`);
      
      setIsModalOpen(false); setFormData(prev => ({ ...prev, amount: '', note: '', type: 'advance' }));
    } catch (error) { console.error(error); }
  };

  const initiateDelete = (deposit: Deposit & { memberName: string }) => {
    if (!user) return;
    setDeleteModal({ isOpen: true, deposit });
  };

  const confirmDelete = async () => {
    if (!deleteModal.deposit) return;
    try {
      await db.collection('deposits').doc(deleteModal.deposit.id).delete();
      await logAction('Delete Deposit', `Removed deposit of ${deleteModal.deposit.amount} BDT for ${deleteModal.deposit.memberName}`);
      setDeleteModal({ isOpen: false, deposit: null });
    } catch(err) {
      console.error(err);
    }
  };

  const filteredDeposits = deposits.filter(deposit => deposit.date.startsWith(selectedMonth));

  const monthTotal = filteredDeposits.reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const monthAdvance = filteredDeposits.filter((d: any) => !d.type || d.type === 'advance').reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const monthFinal = filteredDeposits.filter((d: any) => d.type === 'final').reduce((acc: any, curr: any) => acc + curr.amount, 0);
  const uniqueMembersPaid = new Set(filteredDeposits.map((d: any) => d.memberId)).size;

  const trueNetBalance = useMemo(() => {
      const currentPrice = settings?.mealPrice || 65;
      const [year, month] = selectedMonth.split('-');
      // Start of NEXT month (to include all days of selectedMonth)
      const nextMonthStr = format(new Date(parseInt(year), parseInt(month), 1), 'yyyy-MM-dd');
      
      let totalDeposit = 0;
      allDeposits.forEach(d => {
          if (d.date < nextMonthStr) {
              totalDeposit += d.amount;
          }
      });
      
      let totalMeals = 0;
      allMeals.forEach(mDoc => {
          if (mDoc.date < nextMonthStr) {
              Object.values(mDoc.entries || {}).forEach(entry => {
                  if (entry.lunch) totalMeals++;
                  if (entry.dinner) totalMeals++;
                  if (entry.guestLunch) totalMeals += entry.guestLunch;
                  if (entry.guestDinner) totalMeals += entry.guestDinner;
              });
          }
      });
      
      return totalDeposit - (totalMeals * currentPrice);
  }, [allMeals, allDeposits, selectedMonth, settings]);



  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Deposits</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manage Member Payments</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all">
              <Calendar className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white w-28 md:w-auto cursor-pointer" />
           </div>
          {user && (
            <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-2xl transition-transform hover:scale-105">
              <Plus className="h-5 w-5 stroke-[2.5px]" /> <span className="font-bold">Add</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-6 md:space-y-8">
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Banknote className="h-5 w-5 text-white" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-3xl font-black mb-1">৳{monthTotal.toLocaleString()}</h3>
                      <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Total Month Deposit</p>
                  </div>
              </div>
          </div>
          
          {/* Current Balance Card */}
          <div className={`rounded-3xl p-6 shadow-lg text-white relative overflow-hidden group ${trueNetBalance >= 0 ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20' : 'bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/20'}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          {trueNetBalance >= 0 ? <Banknote className="h-5 w-5 text-white" /> : <AlertTriangle className="h-5 w-5 text-white" />}
                      </div>
                  </div>
                  <div>
                      <h3 className="text-3xl font-black mb-1">
                          {trueNetBalance >= 0 ? '+' : ''}৳{trueNetBalance.toLocaleString()}
                      </h3>
                      <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Net Balance</p>
                  </div>
              </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all">
             <div className="flex flex-col h-full justify-between">
                 <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                     <ArrowDownLeft className="h-5 w-5" />
                 </div>
                 <div>
                     <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">৳{monthAdvance.toLocaleString()}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advance Payments</p>
                 </div>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all">
             <div className="flex flex-col h-full justify-between">
                 <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                     <ArrowDownLeft className="h-5 w-5" />
                 </div>
                 <div>
                     <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">৳{monthFinal.toLocaleString()}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Final Settlements</p>
                 </div>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all">
             <div className="flex flex-col h-full justify-between">
                 <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                     <UsersRound className="h-5 w-5" />
                 </div>
                 <div>
                     <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">{uniqueMembersPaid}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Members Paid</p>
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
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${(!deposit.type || deposit.type === 'advance') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                {(!deposit.type || deposit.type === 'advance') ? 'Advance' : 'Final'}
                            </span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-500">{deposit.note}</td>
                    <td className="px-6 py-4 text-right">{user && <button onClick={() => initiateDelete(deposit)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors"><Trash2 className="h-4 w-4 text-slate-400 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400" /></button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile List View */}
          <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50/30 dark:bg-slate-900/10">
             {filteredDeposits.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                    No deposits found for this month.
                </div>
             ) : (
               filteredDeposits.map(deposit => (
                 <div key={deposit.id} className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start justify-between active:scale-[0.98] transition-transform gap-2">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                       <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                          {(deposit as any).photoBase64 ? (
                              <img src={(deposit as any).photoBase64} alt={deposit.memberName} className="h-full w-full object-cover" />
                          ) : (
                              <ArrowDownLeft className="h-6 w-6 stroke-[1.5px]" />
                          )}
                       </div>
                       <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-800 dark:text-white text-base truncate">{deposit.memberName}</h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">For {format(new Date(deposit.date), 'MMM yyyy')} • Paid {format(new Date(deposit.createdAt || deposit.date), 'dd MMM')}</p>
                          {deposit.note && <p className="text-[11px] text-slate-500 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 truncate max-w-full">{deposit.note}</p>}
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                       <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg tracking-tight">+৳{deposit.amount}</span>
                       <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider mb-1 ${(!deposit.type || deposit.type === 'advance') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                           {(!deposit.type || deposit.type === 'advance') ? 'Advance' : 'Final'}
                       </span>
                       {user && (
                         <button onClick={() => initiateDelete(deposit)} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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

      {/* Add Modal */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add Deposit</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                   <X className="h-6 w-6" />
                </button>
             </div>
             <form onSubmit={handleSubmit} className="space-y-4">
               <select value={formData.memberId} onChange={e => setFormData({...formData, memberId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white">
                 {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
               </select>

               {selectedMemberStats && (
                   <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl text-sm border border-slate-200 dark:border-slate-700">
                       <div className="flex justify-between mb-1.5">
                           <span className="text-slate-500 dark:text-slate-400">Total Deposit</span>
                           <span className="font-bold text-slate-700 dark:text-slate-300">৳{selectedMemberStats.totalDeposit}</span>
                       </div>
                       <div className="flex justify-between mb-2">
                           <span className="text-slate-500 dark:text-slate-400">Total Bill ({selectedMemberStats.totalMeals} Meals)</span>
                           <span className="font-bold text-slate-700 dark:text-slate-300">৳{selectedMemberStats.totalBill}</span>
                       </div>
                       <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
                           <span className="text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider self-center">Current Balance</span>
                           <span className={`font-black text-lg ${selectedMemberStats.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>
                               {selectedMemberStats.netBalance >= 0 ? '+' : ''}৳{selectedMemberStats.netBalance}
                           </span>
                       </div>
                   </div>
               )}
               <input type="number" required placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
               <div className="grid grid-cols-2 gap-3">
                   <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Deposit For Month</label>
                      <input type="month" required value={formData.targetMonth} onChange={e => setFormData({...formData, targetMonth: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
                   </div>
                   <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Deposit Type</label>
                      <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'advance'|'final'})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white">
                          <option value="advance">Advance</option>
                          <option value="final">Final Settlement</option>
                      </select>
                   </div>
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
                    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
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
                        <Button variant="primary" onClick={confirmDelete} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                            Delete
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

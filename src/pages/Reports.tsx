import React, { useState, useMemo, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db, auth } from '../firebase';
import { format } from 'date-fns';
import { Banknote, Calendar, ChevronDown, ChevronRight, Download, MessageCircle } from 'lucide-react';
import { AppSettings, Deposit, DailyMealDoc, Member } from '../types';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';
import type { MemberReport, DailyLog } from '../utils/pdfGenerator';
import { MemberHistory } from '../components/Members/MemberHistory';
import { MonthPicker } from '../components/MonthPicker';
import { getMealRateForMonth, calculateMealCost, formatMealRate } from '../utils/pricing';
import { formatWhatsAppPhone } from '../utils/phone';
import { Toast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { getWhatsAppApiUrl, getApiHeaders } from '../utils/apiConfig';

export const Reports: React.FC = () => {
  const [user, setUser] = useState<firebase.User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUser(u));
    return () => unsub();
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ show: true, type, message });
  };
  const { members, loading: membersLoading } = useMembers();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const loading = membersLoading || mealsLoading || depositsLoading || settingsLoading;
  const currentMonthRate = getMealRateForMonth(settings, selectedMonth);

  const reportData = useMemo(() => {
    if (loading) return [];
    
    const currentPrice = getMealRateForMonth(settings, selectedMonth);
    const membersList = members
      .filter(m => m.status === 'active')
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return membersList.map(member => {
      const startStr = format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), 'yyyy-MM-dd');
      
      let prevTotalDeposit = 0, prevTotalMealCost = 0;
      allDeposits.forEach(d => { if (d.memberId === member.id && d.date < startStr) prevTotalDeposit += d.amount; });
      allMeals.forEach(mDoc => {
         if (mDoc.date < startStr) {
            const entry = mDoc.entries?.[member.id];
            if (entry) { 
              const meals = (entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (Number(entry.guestLunch) || 0) + (Number(entry.guestDinner) || 0);
              const pastMonthRate = getMealRateForMonth(settings, mDoc.date.slice(0, 7));
              prevTotalMealCost += calculateMealCost(meals, pastMonthRate);
            }
         }
      });
      const prevBalance = Math.round(prevTotalDeposit - prevTotalMealCost);

      let advanceDeposit = 0, finalDeposit = 0, currentMonthMeals = 0;
      const dailyLogs: DailyLog[] = [];

      allDeposits.forEach(d => { 
          if (d.memberId === member.id && d.date.startsWith(selectedMonth)) {
              if (d.type === 'final') finalDeposit += d.amount;
              else advanceDeposit += d.amount;
          } 
      });
      
      const sortedMeals = [...allMeals].sort((a, b) => a.date.localeCompare(b.date));
      
      sortedMeals.forEach(mDoc => {
         if (mDoc.date.startsWith(selectedMonth)) {
            const entry = mDoc.entries?.[member.id];
            if (entry) { 
              const mealsInDoc = (entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (Number(entry.guestLunch) || 0) + (Number(entry.guestDinner) || 0);
              currentMonthMeals += mealsInDoc;
              
              dailyLogs.push({
                  date: mDoc.date,
                  lunch: entry.lunch,
                  dinner: entry.dinner,
                  guestLunch: Number(entry.guestLunch) || 0,
                  guestDinner: Number(entry.guestDinner) || 0
              });
            }
         }
      });

      const remainingDeposit = prevBalance + advanceDeposit + finalDeposit;
      const totalCost = calculateMealCost(currentMonthMeals, currentPrice);
      const currentBalance = remainingDeposit - totalCost;

      return { 
          memberId: member.id, 
          memberName: member.fullName, 
          phone: member.phone || '',
          prevBalance, 
          advanceDeposit,
          finalDeposit,
          remainingDeposit, 
          totalMeals: currentMonthMeals, 
          totalCost, 
          currentBalance,
          dailyLogs,
          photoBase64: member.photoBase64
      };
    });
  }, [selectedMonth, members, allMeals, allDeposits, settings, loading]);



  const downloadReceipt = async (item: MemberReport) => {
    const { generatePDF } = await import('../utils/pdfGenerator');
    const doc = await generatePDF(item, selectedMonth, currentMonthRate);
    doc.save(`Report_${item.memberName}_${selectedMonth}.pdf`);
  };

  const sendWhatsApp = async (item: MemberReport) => {
      setSendingId(item.memberId);
      try {
          const { generatePDF } = await import('../utils/pdfGenerator');
          const doc = await generatePDF(item, selectedMonth, currentMonthRate);
          // Convert PDF to Base64 string
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          
          const [yStr, mStr] = selectedMonth.split('-');
          const monthDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
          const monthName = format(monthDate, 'MMMM');
          
          // Save to Firestore 'shared_reports' collection
          const reportRef = await db.collection('shared_reports').add({
              memberName: item.memberName,
              month: monthName,
              pdfBase64: pdfBase64,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Generate the application link
          // Since we use HashRouter, the link format is: url#/view-report?id=ID
          const cleanPath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
          const reportLink = `${window.location.origin}${cleanPath}/#/view-report?id=${reportRef.id}`;

          const isDue = item.currentBalance < 0;
          const standingText = isDue 
              ? `🚨 বকেয়া পাওনা: ৳${Math.abs(item.currentBalance)}`
              : `✅ উদ্বৃত্ত জমা: ৳${Math.abs(item.currentBalance)}`;

          const currentDeposit = item.advanceDeposit + item.finalDeposit;
          const prevBalanceSign = item.prevBalance >= 0 ? '+' : '-';

          const message = 
              `📋 *মাসিক মিল হিসাব বিবরণী | ${monthName.toUpperCase()}*\n\n` +
              `আসসালামু আলাইকুম ${item.memberName}, আপনার ${monthName} মাসের সার্বিক মিল ও ব্যয়ের চূড়ান্ত হিসাব বিবরণী নিচে উপস্থাপন করা হলো:\n\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `📊 *হিসাবের সারসংক্ষেপ:*\n` +
              `• 🍽️ *মোট মিল সংখ্যা:* ${item.totalMeals} টি\n` +
              `• 🏷️ *গড় মিল রেট:* ৳${formatMealRate(currentMonthRate)} / মিল\n` +
              `• 💸 *মোট মিল ব্যয়:* ৳${item.totalCost}\n` +
              `• 💳 *পূর্ববর্তী জের:* ${prevBalanceSign}৳${Math.abs(item.prevBalance)}\n` +
              `• 📥 *চলতি মাসে পরিশোধ:* ৳${currentDeposit}\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *বর্তমান হিসাব স্থিতি:* ${standingText}\n` +
              `━━━━━━━━━━━━━━━━━━━\n\n` +
              `📄 *অফিসিয়াল ডিজিটাল ভাউচার / ইনভয়েস:*\n${reportLink}\n\n` +
              `_বিনীত,_\n` +
              `*Meal Manager*`;
          
          const encodedMsg = encodeURIComponent(message);
          const phone = formatWhatsAppPhone(item.phone);

          if (!phone) {
              showToast('warning', `⚠️ No valid mobile number found for "${item.memberName}"! Please add phone in member profile.`);
              setSendingId(null);
              return;
          }

          // Check if WhatsApp bot is connected and send automatically
          let sentDirectly = false;
          const apiBase = getWhatsAppApiUrl(settings);
          try {
              const res = await fetch(`${apiBase}/api/monthly-statement`, {
                  method: 'POST',
                  headers: getApiHeaders(),
                  body: JSON.stringify({
                      memberName: item.memberName,
                      phone: phone,
                      monthName: monthName,
                      totalMeals: item.totalMeals,
                      mealRate: currentMonthRate,
                      totalCost: item.totalCost,
                      prevBalance: item.prevBalance,
                      totalDeposit: currentDeposit,
                      currentBalance: item.currentBalance,
                      invoiceUrl: reportLink,
                      pdfBase64: pdfBase64
                  })
              });
              const data = await res.json();
              if (data && data.success) {
                  sentDirectly = true;
                  showToast('success', `✅ PDF invoice sent directly to ${item.memberName} (${phone}) via WhatsApp!`);
              }
          } catch (e) {
              // Local bot offline, proceed to web fallback
          }

          if (!sentDirectly) {
              window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
          }
      } catch (error) {
          console.error("WhatsApp Link Sharing failed:", error);
          showToast('error', "Failed to create invoice link. Please check internet connection.");
      } finally {
          setSendingId(null);
      }
  };

  const exportCSV = () => {
    const headers = ['Member Name', 'Prev. Balance', 'Deposit', 'Total Available', 'Total Meals', 'Total Cost', 'Current Balance'];
    const rows = reportData.map(item => [
      item.memberName,
      item.prevBalance,
      item.advanceDeposit + item.finalDeposit,
      item.remainingDeposit,
      item.totalMeals,
      item.totalCost,
      item.currentBalance
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Monthly_Report_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const grandTotalBalance = reportData.reduce((acc, curr) => acc + curr.currentBalance, 0);
  const grandTotalMeals = reportData.reduce((acc, curr) => acc + curr.totalMeals, 0);
  const grandTotalAdvance = reportData.reduce((acc, curr) => acc + curr.advanceDeposit, 0);
  const grandTotalFinal = reportData.reduce((acc, curr) => acc + curr.finalDeposit, 0);
  const grandTotalCost = reportData.reduce((acc, curr) => acc + curr.totalCost, 0);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
       {viewMember && (
         <MemberHistory 
           member={viewMember} 
           initialMonth={selectedMonth} 
           onClose={() => setViewMember(null)} 
         />
       )}

       <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 md:py-6 -mt-4 md:-mt-8 mb-4">
          <div>
             <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Monthly Report</h2>
             <p className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Meal & Billing Statement</p>
          </div>
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2">
             <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
             {user && (
               <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl shadow-sm text-xs sm:text-sm font-bold transition-all active:scale-95">
                  <Download className="h-4 w-4" /> <span>Export CSV</span>
               </button>
             )}
          </div>
       </div>

       <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 sm:space-y-6 pb-10">
       <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
           <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Total Meals</p>
                   <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{grandTotalMeals}</div>
               </div>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-emerald-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Total Bill</p>
                   <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">৳{grandTotalCost.toLocaleString()}</div>
               </div>
           </div>

            {/* Unified Total Deposit Card */}
            <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-amber-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Total Deposit</p>
                    <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">৳{(grandTotalAdvance + grandTotalFinal).toLocaleString()}</div>
                </div>
            </div>

            {/* Dynamic Meal Rate for Selected Month Card */}
            <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-blue-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Meal Rate</p>
                    <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 flex items-baseline">
                        ৳{formatMealRate(currentMonthRate)}<span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">/meal</span>
                    </div>
                </div>
            </div>

           <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-sm relative overflow-hidden">
               <div className="relative z-10 flex items-center justify-between">
                   <div>
                       <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Net Balance</p>
                       <div className={`text-xl sm:text-2xl font-black ${grandTotalBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {grandTotalBalance >= 0 ? '+' : ''}৳{grandTotalBalance.toLocaleString()}
                       </div>
                   </div>
                   <Banknote className="h-8 w-8 text-white/10 shrink-0" />
               </div>
           </div>
       </div>

       {/* Desktop Table */}
       <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           <table className="w-full text-left">
               <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                   <tr>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase">Name (Tap for breakdown)</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Prev. Bal</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Deposit</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Total Avail</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Meals</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Cost</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-right">Curr. Bal</th>
                       {user && (
                         <>
                           <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Receipt</th>
                           <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">WhatsApp</th>
                         </>
                       )}
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                   {reportData.map((item) => (
                       <tr key={item.memberId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm transition-colors">
                           <td 
                             onClick={() => {
                               const mem = members.find(m => m.id === item.memberId);
                               if (mem) setViewMember(mem);
                             }}
                             className="px-4 py-3 dark:text-slate-200 cursor-pointer group/name"
                             title="Click to view detailed breakdown"
                           >
                               <div className="flex items-center gap-3">
                                   <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden shrink-0 group-hover/name:ring-2 group-hover/name:ring-emerald-500 transition-all">
                                       {item.photoBase64 ? (
                                           <img src={item.photoBase64} alt={item.memberName} className="h-full w-full object-cover" />
                                       ) : (
                                           item.memberName.charAt(0)
                                       )}
                                   </div>
                                   <span className="font-bold group-hover/name:text-emerald-600 dark:group-hover/name:text-emerald-400 transition-colors flex items-center gap-1.5">
                                     {item.memberName}
                                     <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover/name:opacity-100 text-emerald-500 transition-opacity" />
                                   </span>
                               </div>
                           </td>
                           <td className={`px-4 py-3 text-center font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>{item.prevBalance}</td>
                           <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{item.advanceDeposit + item.finalDeposit}</td>
                           <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">{item.remainingDeposit}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalMeals}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalCost}</td>
                           <td className={`px-4 py-3 text-right font-bold ${item.currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>{item.currentBalance}</td>
                           <td className="px-4 py-3 text-center">
                               <button onClick={() => downloadReceipt(item)} className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors" title="Download PDF Statement">
                                   <Download className="h-4 w-4" />
                               </button>
                           </td>
                           <td className="px-4 py-3 text-center">
                               <button 
                                 disabled={sendingId !== null}
                                 onClick={() => sendWhatsApp(item)} 
                                 className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors disabled:opacity-50"
                                 title="Send on WhatsApp"
                               >
                                   {sendingId === item.memberId ? <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <MessageCircle className="h-4 w-4" />}
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>

       {/* Mobile Native Statement Cards */}
       <div className="md:hidden space-y-3">
          {reportData.map((item) => {
            const isExpanded = expandedCard === item.memberId;
            const isDue = item.currentBalance < 0;
            return (
              <div key={item.memberId} className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-700/80 transition-all">
                 <div 
                   className="flex justify-between items-start mb-3 cursor-pointer group"
                   onClick={() => {
                     const mem = members.find(m => m.id === item.memberId);
                     if (mem) setViewMember(mem);
                   }}
                 >
                     <div className="flex items-center gap-3">
                         <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-600/60">
                             {item.photoBase64 ? (
                                 <img src={item.photoBase64} alt={item.memberName} className="h-full w-full object-cover" />
                             ) : (
                                 item.memberName.charAt(0)
                             )}
                         </div>
                         <div>
                             <h3 className="font-bold text-slate-800 dark:text-white text-base leading-snug flex items-center gap-1.5 group-hover:text-emerald-600 transition-colors">
                               {item.memberName}
                               <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0" />
                             </h3>
                             <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Tap for full breakdown</p>
                         </div>
                     </div>
                     <div className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-tight ${!isDue ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40'}`}>
                        {!isDue ? '+' : ''}{item.currentBalance} ৳
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 mb-3" onClick={() => setExpandedCard(isExpanded ? null : item.memberId)}>
                     <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Meals</span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-200">{item.totalMeals}</span>
                     </div>
                     <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bill</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{item.totalCost} ৳</span>
                     </div>
                 </div>

                 
                  {user && (
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); downloadReceipt(item); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all active:scale-95">
                          <Download className="h-3.5 w-3.5" /> Receipt PDF
                      </button>
                      <button 
                        disabled={sendingId !== null}
                        onClick={(e) => { e.stopPropagation(); sendWhatsApp(item); }} 
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-200/40 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                      >
                          {sendingId === item.memberId ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</>}
                      </button>
                    </div>
                  )}

                 {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-y-3 text-xs animate-in slide-in-from-top-2 fade-in">
                       <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Prev. Balance</span>
                          <span className={`font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{item.prevBalance} ৳</span>
                       </div>
                       <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Deposit</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.advanceDeposit + item.finalDeposit} ৳</span>
                       </div>
                       <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Available</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.remainingDeposit} ৳</span>
                       </div>
                       <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Meal Rate</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">৳{formatMealRate(currentMonthRate)}/meal</span>
                       </div>
                    </div>
                 )}
                 <div className="flex justify-center mt-2 cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : item.memberId)}>
                    <ChevronDown className={`h-4 w-4 text-slate-300 dark:text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                 </div>
              </div>
            )
          })}
       </div>
       </div>

       {/* In-app Toast Notification */}
       <Toast
         show={toast.show}
         type={toast.type}
         message={toast.message}
         onClose={() => setToast(prev => ({ ...prev, show: false }))}
       />

       {/* In-app Confirmation Dialog */}
       <ConfirmModal
         isOpen={confirmModal.isOpen}
         title={confirmModal.title}
         message={confirmModal.message}
         onConfirm={confirmModal.onConfirm}
         onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
       />
    </div>
  );
};

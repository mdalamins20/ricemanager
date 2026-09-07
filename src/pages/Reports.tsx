import React, { useState, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { format } from 'date-fns';
import { Banknote, Calendar, ChevronDown, Download, MessageCircle } from 'lucide-react';
import { AppSettings, Deposit, DailyMealDoc, Member } from '../types';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';
import { generatePDF, MemberReport, DailyLog } from '../utils/pdfGenerator';



export const Reports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { members, loading: membersLoading } = useMembers();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const loading = membersLoading || mealsLoading || depositsLoading || settingsLoading;

  const reportData = useMemo(() => {
    if (loading) return [];
    
    const currentPrice = settings?.mealPrice || 65;
    const membersList = [...members].sort((a, b) => a.fullName.localeCompare(b.fullName));

    return membersList.map(member => {
      const startStr = format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), 'yyyy-MM-dd');
      
      let prevTotalDeposit = 0, prevTotalMeals = 0;
      allDeposits.forEach(d => { if (d.memberId === member.id && d.date < startStr) prevTotalDeposit += d.amount; });
      allMeals.forEach(mDoc => {
         if (mDoc.date < startStr) {
            const entry = mDoc.entries?.[member.id];
            if (entry) { 
              if (entry.lunch) prevTotalMeals++; 
              if (entry.dinner) prevTotalMeals++; 
              if (entry.guestLunch) prevTotalMeals += entry.guestLunch;
              if (entry.guestDinner) prevTotalMeals += entry.guestDinner;
            }
         }
      });
      const prevBalance = prevTotalDeposit - (prevTotalMeals * currentPrice);

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
              const mealsInDoc = (entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (entry.guestLunch || 0) + (entry.guestDinner || 0);
              currentMonthMeals += mealsInDoc;
              
              dailyLogs.push({
                  date: mDoc.date,
                  lunch: entry.lunch,
                  dinner: entry.dinner,
                  guestLunch: entry.guestLunch || 0,
                  guestDinner: entry.guestDinner || 0
              });
            }
         }
      });

      const remainingDeposit = prevBalance + advanceDeposit + finalDeposit;
      const totalCost = currentMonthMeals * currentPrice;
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
    const doc = await generatePDF(item, selectedMonth);
    doc.save(`Report_${item.memberName}_${selectedMonth}.pdf`);
  };

  const sendWhatsApp = async (item: MemberReport) => {
      setSendingId(item.memberId);
      try {
          const doc = await generatePDF(item, selectedMonth);
          // Convert PDF to Base64 string
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          
          const monthName = format(new Date(selectedMonth), 'MMMM');
          
          // Save to Firestore 'shared_reports' collection
          const reportRef = await db.collection('shared_reports').add({
              memberName: item.memberName,
              month: monthName,
              pdfBase64: pdfBase64,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Generate the application link
          // Since we use HashRouter, the link format is: url#/view-report?id=ID
          const baseUrl = window.location.origin + window.location.pathname + window.location.search;
          const reportLink = `${baseUrl}#/view-report?id=${reportRef.id}`;

          const isDue = item.currentBalance < 0;
          
          const urgentNote = isDue 
              ? `⚠️ *জরুরী নোটিশ:*\nআপনার মোট *${Math.abs(item.currentBalance)} টাকা* বকেয়া (Due) রয়েছে। দয়া করে অতি দ্রুত আপনার বকেয়া টাকা পরিশোধ করুন।`
              : `✅ *STATUS: CLEAR*\nআপনার কোনো বকেয়া নেই।`;

          const message = `📊 *Monthly Statement | ${monthName}*\n\n` +
              `👤 *Name:* ${item.memberName}\n` +
              `------------------------\n` +
              `🍽️ *Total Meals:* ${item.totalMeals}\n` +
              `💰 *Total Bill:* ${item.totalCost} TK\n` +
              `💵 *${item.remainingDeposit < 0 ? 'Previous Due' : 'Total Deposit'}:* ${Math.abs(item.remainingDeposit)} TK\n` +
              `------------------------\n` +
              `📉 *Net Balance: ${item.currentBalance} TK*\n\n` +
              `📄 *Download Full Invoice:*\n${reportLink}\n\n` +
              `${urgentNote}`;
          
          const encodedMsg = encodeURIComponent(message);
          const phone = item.phone.startsWith('0') ? '88' + item.phone : item.phone;
          window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
      } catch (error) {
          console.error("WhatsApp Link Sharing failed:", error);
          alert("Failed to generate link. Check your internet.");
      } finally {
          setSendingId(null);
      }
  };

  const exportCSV = () => {
    const headers = ['Member Name', 'Prev. Balance', 'Advance', 'Final Settlement', 'Total Available', 'Total Meals', 'Total Cost', 'Current Balance'];
    const rows = reportData.map(item => [
      item.memberName,
      item.prevBalance,
      item.advanceDeposit,
      item.finalDeposit,
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
  };

  const grandTotalBalance = reportData.reduce((acc, curr) => acc + curr.currentBalance, 0);
  const grandTotalMeals = reportData.reduce((acc, curr) => acc + curr.totalMeals, 0);
  const grandTotalAdvance = reportData.reduce((acc, curr) => acc + curr.advanceDeposit, 0);
  const grandTotalFinal = reportData.reduce((acc, curr) => acc + curr.finalDeposit, 0);
  const grandTotalCost = reportData.reduce((acc, curr) => acc + curr.totalCost, 0);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
       <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Monthly Report</h2>
          <div className="flex items-center gap-2">
             <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm text-sm font-bold transition-all">
                <Download className="h-4 w-4" /> Export CSV
             </button>
             <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white w-24 md:w-auto" />
             </div>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-10">
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Meals</p>
                   <div className="text-2xl font-bold text-slate-800 dark:text-white">{grandTotalMeals}</div>
               </div>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-amber-500 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Advance</p>
                   <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">৳{grandTotalAdvance.toLocaleString()}</div>
               </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-blue-500 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Final Settled</p>
                   <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">৳{grandTotalFinal.toLocaleString()}</div>
               </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Bill</p>
                   <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{grandTotalCost.toLocaleString()}</div>
               </div>
           </div>

           <div className="bg-slate-800 dark:bg-slate-900 text-white p-5 rounded-2xl border border-slate-700 dark:border-slate-800 shadow-sm relative overflow-hidden">
               <div className="relative z-10">
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Net Balance</p>
                   <div className={`text-2xl font-bold ${grandTotalBalance >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                   {grandTotalBalance >= 0 ? '+' : ''}৳{grandTotalBalance.toLocaleString()}
                   </div>
               </div>
               <Banknote className="absolute right-4 top-4 h-16 w-16 text-white opacity-5" />
           </div>
       </div>

       {/* Desktop Table */}
       <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           <table className="w-full text-left">
               <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                   <tr>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase">Name</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Prev. Bal</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Advance</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Final</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Total Avail</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Meals</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Cost</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-right">Curr. Bal</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Receipt</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">WhatsApp</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                   {reportData.map((item) => (
                       <tr key={item.memberId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm transition-colors">
                           <td className="px-4 py-3 dark:text-slate-200">
                               <div className="flex items-center gap-3">
                                   <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden shrink-0">
                                       {item.photoBase64 ? (
                                           <img src={item.photoBase64} alt={item.memberName} className="h-full w-full object-cover" />
                                       ) : (
                                           item.memberName.charAt(0)
                                       )}
                                   </div>
                                   <span className="font-bold">{item.memberName}</span>
                               </div>
                           </td>
                           <td className={`px-4 py-3 text-center font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>{item.prevBalance}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.advanceDeposit}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.finalDeposit}</td>
                           <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">{item.remainingDeposit}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalMeals}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalCost}</td>
                           <td className={`px-4 py-3 text-right font-bold ${item.currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>{item.currentBalance}</td>
                           <td className="px-4 py-3 text-center">
                               <button onClick={() => downloadReceipt(item)} className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors">
                                   <Download className="h-4 w-4" />
                               </button>
                           </td>
                           <td className="px-4 py-3 text-center">
                               <button 
                                 disabled={sendingId !== null}
                                 onClick={() => sendWhatsApp(item)} 
                                 className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors disabled:opacity-50"
                               >
                                   {sendingId === item.memberId ? <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <MessageCircle className="h-4 w-4" />}
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>

       {/* Mobile Cards */}
       <div className="md:hidden space-y-3">
          {reportData.map((item) => {
            const isExpanded = expandedCard === item.memberId;
            return (
              <div key={item.memberId} className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700" onClick={() => setExpandedCard(isExpanded ? null : item.memberId)}>
                 <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 overflow-hidden shrink-0">
                             {item.photoBase64 ? (
                                 <img src={item.photoBase64} alt={item.memberName} className="h-full w-full object-cover" />
                             ) : (
                                 item.memberName.charAt(0)
                             )}
                         </div>
                         <h3 className="font-bold text-slate-800 dark:text-white text-lg">{item.memberName}</h3>
                     </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${item.currentBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500'}`}>
                        {item.currentBalance} ৳
                    </div>
                 </div>
                 
                 <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-6">
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Meals</span>
                        <strong className="text-slate-800 dark:text-slate-200 text-lg">{item.totalMeals}</strong>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Bill</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 text-lg">{item.totalCost} ৳</strong>
                     </div>
                 </div>

                 <div className="flex items-center gap-2 mt-2">
                     <button onClick={(e) => { e.stopPropagation(); downloadReceipt(item); }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-sm transition-all active:scale-95">
                         <Download className="h-4 w-4" /> PDF
                     </button>
                     <button 
                       disabled={sendingId !== null}
                       onClick={(e) => { e.stopPropagation(); sendWhatsApp(item); }} 
                       className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                     >
                         {sendingId === item.memberId ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><MessageCircle className="h-4 w-4" /> WhatsApp</>}
                     </button>
                 </div>

                 {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-y-4 text-sm animate-in slide-in-from-top-2 fade-in">
                       <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Prev. Balance</span>
                          <span className={`font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'}`}>{item.prevBalance} ৳</span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Advance</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{item.advanceDeposit} ৳</span>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Final Settled</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{item.finalDeposit} ৳</span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Available</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.remainingDeposit} ৳</span>
                       </div>
                    </div>
                 )}
                 <div className="flex justify-center mt-4">
                    <ChevronDown className={`h-5 w-5 text-slate-300 dark:text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                 </div>
              </div>
            )
          })}
       </div>
       </div>
    </div>
  );
};

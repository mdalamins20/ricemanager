import React, { useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { format } from 'date-fns';
import { Banknote, Calendar, ChevronDown, Download, MessageCircle } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings, Deposit } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyLog {
  date: string;
  lunch: boolean;
  dinner: boolean;
  guestLunch: number;
  guestDinner: number;
}

interface MemberReport {
  memberId: string;
  memberName: string;
  phone: string;
  prevBalance: number;
  currentDeposit: number;
  remainingDeposit: number;
  totalMeals: number;
  totalCost: number;
  currentBalance: number;
  dailyLogs: DailyLog[];
}

export const Reports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportData, setReportData] = useState<MemberReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  useEffect(() => {
    const fetchFullReport = async () => {
      setLoading(true);
      try {
        const settingsSnap = await db.collection('settings').doc('config').get();
        const currentPrice = settingsSnap.exists ? (settingsSnap.data() as AppSettings).mealPrice : 65;
        const membersSnap = await db.collection('members').orderBy('fullName').get();
        const membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
        const mealsSnap = await db.collection('meals').get();
        const allMeals = mealsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as unknown as DailyMealDoc);
        const depositsSnap = await db.collection('deposits').get();
        const allDeposits = depositsSnap.docs.map(d => d.data() as Deposit);

        const report: MemberReport[] = membersList.map(member => {
          const startStr = format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), 'yyyy-MM-dd');
          
          let prevTotalDeposit = 0, prevTotalMeals = 0;
          allDeposits.forEach(d => { if (d.memberId === member.id && d.date < startStr) prevTotalDeposit += d.amount; });
          allMeals.forEach(mDoc => {
             if (mDoc.date < startStr) {
                const entry = mDoc.entries[member.id];
                if (entry) { 
                  if (entry.lunch) prevTotalMeals++; 
                  if (entry.dinner) prevTotalMeals++; 
                  if (entry.guestLunch) prevTotalMeals += entry.guestLunch;
                  if (entry.guestDinner) prevTotalMeals += entry.guestDinner;
                }
             }
          });
          const prevBalance = prevTotalDeposit - (prevTotalMeals * currentPrice);

          let currentMonthDeposit = 0, currentMonthMeals = 0;
          const dailyLogs: DailyLog[] = [];

          allDeposits.forEach(d => { if (d.memberId === member.id && d.date.startsWith(selectedMonth)) currentMonthDeposit += d.amount; });
          
          const sortedMeals = [...allMeals].sort((a, b) => a.date.localeCompare(b.date));
          
          sortedMeals.forEach(mDoc => {
             if (mDoc.date.startsWith(selectedMonth)) {
                const entry = mDoc.entries[member.id];
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

          const remainingDeposit = prevBalance + currentMonthDeposit;
          const totalCost = currentMonthMeals * currentPrice;
          const currentBalance = remainingDeposit - totalCost;

          return { 
              memberId: member.id, 
              memberName: member.fullName, 
              phone: member.phone || '',
              prevBalance, 
              currentDeposit: currentMonthDeposit, 
              remainingDeposit, 
              totalMeals: currentMonthMeals, 
              totalCost, 
              currentBalance,
              dailyLogs
          };
        });
        setReportData(report);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchFullReport();
  }, [selectedMonth]);

  const generatePDF = (item: MemberReport) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const monthName = format(new Date(selectedMonth), 'MMMM yyyy');

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('RiceManager', 15, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('DETAILED MONTHLY STATEMENT', 150, 25);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Member Information', 15, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${item.memberName}`, 15, 63);
    doc.text(`Phone: ${item.phone}`, 15, 69);
    doc.text(`Billing Month: ${monthName}`, 15, 75);
    doc.text(`Statement Date: ${format(new Date(), 'dd MMM, yyyy')}`, 15, 81);

    autoTable(doc, {
      startY: 90,
      head: [['Financial Summary', 'Amount (BDT)']],
      body: [
        ['Previous Balance (Brought Forward)', `${item.prevBalance >= 0 ? '+' : ''}${item.prevBalance}`],
        ['Total Deposit (This Month)', `+${item.currentDeposit}`],
        ['Total Available Funds', `${item.remainingDeposit}`],
        [`Total Meals Consumed (${item.totalMeals})`, `-${item.totalCost}`],
      ],
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 6 },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFillColor(item.currentBalance >= 0 ? 240 : 254, item.currentBalance >= 0 ? 253 : 242, item.currentBalance >= 0 ? 244 : 242);
    doc.rect(15, finalY, 180, 20, 'F');
    doc.setTextColor(item.currentBalance >= 0 ? 5 : 185, item.currentBalance >= 0 ? 150 : 28, item.currentBalance >= 0 ? 105 : 28);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Closing Balance:', 25, finalY + 13);
    doc.text(`${item.currentBalance} TK`, 185, finalY + 13, { align: 'right' });

    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Daily Meal Consumption Log', 15, 13);

    autoTable(doc, {
      startY: 25,
      head: [['Date', 'Lunch', 'Dinner', 'Guest', 'Total']],
      body: item.dailyLogs.map(log => [
          format(new Date(log.date), 'dd MMM (EEE)'),
          log.lunch ? '1' : '-',
          log.dinner ? '1' : '-',
          (log.guestLunch + log.guestDinner) > 0 ? (log.guestLunch + log.guestDinner) : '-',
          (log.lunch ? 1 : 0) + (log.dinner ? 1 : 0) + log.guestLunch + log.guestDinner
      ]),
      theme: 'striped',
      styles: { fontSize: 9, halign: 'center' },
      headStyles: { fillColor: [100, 116, 139] },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount} | Generated by RiceManager`, 105, 285, { align: 'center' });
    }

    return doc;
  };

  const downloadReceipt = (item: MemberReport) => {
    const doc = generatePDF(item);
    doc.save(`Report_${item.memberName}_${selectedMonth}.pdf`);
  };

  const sendWhatsApp = async (item: MemberReport) => {
      setSendingId(item.memberId);
      try {
          const doc = generatePDF(item);
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

          const message = `*Monthly Statement: ${monthName}*\n\n` +
              `Hello *${item.memberName}*,\n` +
              `Your detailed meal report is ready.\n\n` +
              `Total Meals: ${item.totalMeals}\n` +
              `Total Bill: ${item.totalCost} TK\n` +
              `*Net Balance: ${item.currentBalance} TK*\n\n` +
              `View your detailed report here:\n${reportLink}\n\n` +
              `_Thank you for using RiceManager._`;
          
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
    const headers = ['Member Name', 'Prev. Balance', 'Monthly Deposit', 'Total Available', 'Total Meals', 'Total Cost', 'Current Balance'];
    const rows = reportData.map(item => [
      item.memberName,
      item.prevBalance,
      item.currentDeposit,
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

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

       <div className="bg-slate-800 dark:bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-lg border border-slate-700 dark:border-slate-800">
           <div className="relative z-10">
               <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Net Balance ({format(new Date(selectedMonth), 'MMM')})</p>
               <div className={`text-3xl font-bold ${grandTotalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
               {grandTotalBalance >= 0 ? '+' : ''}৳{grandTotalBalance.toLocaleString()}
               </div>
           </div>
           <Banknote className="absolute right-4 top-4 h-24 w-24 text-white opacity-5" />
       </div>

       {/* Desktop Table */}
       <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           <table className="w-full text-left">
               <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                   <tr>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase">Name</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Prev. Bal</th>
                       <th className="px-4 py-4 text-xs font-bold text-slate-600 uppercase text-center">Deposit</th>
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
                           <td className="px-4 py-3 font-bold dark:text-slate-200">{item.memberName}</td>
                           <td className={`px-4 py-3 text-center font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{item.prevBalance}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.currentDeposit}</td>
                           <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">{item.remainingDeposit}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalMeals}</td>
                           <td className="px-4 py-3 text-center dark:text-slate-300">{item.totalCost}</td>
                           <td className={`px-4 py-3 text-right font-bold ${item.currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{item.currentBalance}</td>
                           <td className="px-4 py-3 text-center">
                               <button onClick={() => downloadReceipt(item)} className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
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
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{item.memberName}</h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${item.currentBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
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
                        <strong className="text-red-600 dark:text-red-400 text-lg">{item.totalCost} ৳</strong>
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
                          <span className={`font-bold ${item.prevBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{item.prevBalance} ৳</span>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Deposit</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{item.currentDeposit} ৳</span>
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
  );
};

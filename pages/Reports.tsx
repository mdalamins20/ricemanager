import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Download, Filter, Trophy, Banknote } from 'lucide-react';
import { Member, DailyMealDoc, MonthlySummary, AppSettings } from '../types';

export const Reports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalMealsCount, setTotalMealsCount] = useState(0);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
        const price = settingsSnap.exists() ? (settingsSnap.data() as AppSettings).mealPrice : 65;

        const membersSnap = await getDocs(collection(db, 'members'));
        const memberMap: Record<string, string> = {};
        membersSnap.docs.forEach(d => memberMap[d.id] = d.data().fullName);

        const start = startOfMonth(new Date(selectedMonth));
        const end = endOfMonth(new Date(selectedMonth));
        const days = eachDayOfInterval({ start, end });
        
        const promises = days.map(day => getDoc(doc(db, 'meals', format(day, 'yyyy-MM-dd'))));
        const mealDocs = await Promise.all(promises);

        const agg: Record<string, MonthlySummary> = {};
        Object.keys(memberMap).forEach(id => {
          agg[id] = {
            memberId: id,
            memberName: memberMap[id],
            totalLunch: 0,
            totalDinner: 0,
            totalMeals: 0,
            payableAmount: 0
          };
        });

        mealDocs.forEach(d => {
          if (d.exists()) {
            const data = d.data() as DailyMealDoc;
            Object.entries(data.entries).forEach(([memberId, entry]) => {
              if (agg[memberId]) {
                if (entry.lunch) agg[memberId].totalLunch++;
                if (entry.dinner) agg[memberId].totalDinner++;
              }
            });
          }
        });

        let totalMoney = 0;
        let tMeals = 0;
        const result = Object.values(agg).map(item => {
          item.totalMeals = item.totalLunch + item.totalDinner;
          item.payableAmount = item.totalMeals * price;
          totalMoney += item.payableAmount;
          tMeals += item.totalMeals;
          return item;
        }).filter(item => item.totalMeals > 0).sort((a,b) => b.totalMeals - a.totalMeals);

        setSummary(result);
        setGrandTotal(totalMoney);
        setTotalMealsCount(tMeals);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Monthly Report</h2>
          <p className="text-slate-500 text-sm">Review meal consumption & billing</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200 flex-1 md:flex-none shadow-sm">
             <Filter className="h-4 w-4 text-slate-500" />
             <input
               type="month"
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(e.target.value)}
               className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full"
             />
          </div>
          <button className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100 transition shadow-sm" title="Download">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-6">
         <div className="bg-gradient-to-br from-red-600 to-red-700 text-white p-5 rounded-2xl shadow-lg shadow-red-200">
            <p className="text-red-100 text-xs font-bold uppercase tracking-wider mb-1">Total Collection</p>
            <div className="flex items-baseline gap-1">
               <span className="text-3xl font-bold">৳{grandTotal}</span>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Meals Served</p>
            <div className="flex items-baseline gap-1">
               <span className="text-3xl font-bold text-slate-800">{totalMealsCount}</span>
               <span className="text-sm text-slate-400">plates</span>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
              Calculating report...
            </div>
        ) : (
            <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                <thead>
                    <tr className="bg-red-50/50 border-b border-red-100 text-xs uppercase text-red-600 font-bold">
                    <th className="px-6 py-4">Rank & Name</th>
                    <th className="px-6 py-4 text-center">Lunch</th>
                    <th className="px-6 py-4 text-center">Dinner</th>
                    <th className="px-6 py-4 text-center">Total Meals</th>
                    <th className="px-6 py-4 text-right">Payable (BDT)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {summary.map((item, idx) => (
                    <tr key={item.memberId} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-3">
                           <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                             {idx + 1}
                           </span>
                           {item.memberName}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500">{item.totalLunch}</td>
                        <td className="px-6 py-4 text-center text-slate-500">{item.totalDinner}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800 bg-slate-50">{item.totalMeals}</td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">৳{item.payableAmount}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-100">
                {summary.map((item, idx) => (
                  <div key={item.memberId} className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                             {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{item.memberName}</span>
                         </div>
                         <span className="font-bold text-red-600 text-lg">৳{item.payableAmount}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                         <div className="bg-slate-50 p-2 rounded-lg">
                            <div className="text-[10px] uppercase text-slate-400 font-bold">Lunch</div>
                            <div className="font-semibold text-slate-700">{item.totalLunch}</div>
                         </div>
                         <div className="bg-slate-50 p-2 rounded-lg">
                            <div className="text-[10px] uppercase text-slate-400 font-bold">Dinner</div>
                            <div className="font-semibold text-slate-700">{item.totalDinner}</div>
                         </div>
                         <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                            <div className="text-[10px] uppercase text-red-400 font-bold">Total</div>
                            <div className="font-bold text-red-700">{item.totalMeals}</div>
                         </div>
                      </div>
                  </div>
                ))}
                {summary.length === 0 && <div className="p-8 text-center text-slate-500">No data found.</div>}
            </div>
            </>
        )}
      </div>
    </div>
  );
};
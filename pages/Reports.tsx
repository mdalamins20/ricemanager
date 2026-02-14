import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import format from 'date-fns/format';
import startOfMonth from 'date-fns/startOfMonth';
import endOfMonth from 'date-fns/endOfMonth';
import eachDayOfInterval from 'date-fns/eachDayOfInterval';
import { Download, Filter } from 'lucide-react';
import { Member, DailyMealDoc, MonthlySummary, AppSettings } from '../types';

export const Reports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        // 1. Get Settings (Price)
        const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
        const price = settingsSnap.exists() ? (settingsSnap.data() as AppSettings).mealPrice : 65;

        // 2. Get All Members (Active & Inactive needed for historical data ideally, but we'll fetch all)
        const membersSnap = await getDocs(collection(db, 'members'));
        const memberMap: Record<string, string> = {};
        membersSnap.docs.forEach(d => memberMap[d.id] = d.data().fullName);

        // 3. Generate date keys for the month
        const start = startOfMonth(new Date(selectedMonth));
        const end = endOfMonth(new Date(selectedMonth));
        const days = eachDayOfInterval({ start, end });
        
        // 4. Fetch meals for each day
        // Note: For production with thousands of days, query with range is better.
        // For < 31 reads per report generation, Promise.all is acceptable.
        const promises = days.map(day => getDoc(doc(db, 'meals', format(day, 'yyyy-MM-dd'))));
        const mealDocs = await Promise.all(promises);

        // 5. Aggregate
        const agg: Record<string, MonthlySummary> = {};
        
        // Initialize aggregation for known members to ensure they appear even if 0 meals
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

        // Finalize calculations
        let totalMoney = 0;
        const result = Object.values(agg).map(item => {
          item.totalMeals = item.totalLunch + item.totalDinner;
          item.payableAmount = item.totalMeals * price;
          totalMoney += item.payableAmount;
          return item;
        }).filter(item => item.totalMeals > 0); // Optional: Hide members with 0 meals

        setSummary(result);
        setGrandTotal(totalMoney);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedMonth]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monthly Report</h2>
          <p className="text-slate-500">Overview of meal consumption and billing</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
             <Filter className="h-4 w-4 text-slate-500" />
             <input
               type="month"
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(e.target.value)}
               className="bg-transparent outline-none text-sm font-medium"
             />
          </div>
          <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Export CSV (Demo)">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
            <div className="p-12 text-center text-slate-500">Generating report...</div>
        ) : (
            <>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                    <th className="px-6 py-4">Member Name</th>
                    <th className="px-6 py-4 text-center">Lunch Qty</th>
                    <th className="px-6 py-4 text-center">Dinner Qty</th>
                    <th className="px-6 py-4 text-center">Total Meals</th>
                    <th className="px-6 py-4 text-right">Total Amount (BDT)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {summary.map(item => (
                    <tr key={item.memberId} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.memberName}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{item.totalLunch}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{item.totalDinner}</td>
                        <td className="px-6 py-4 text-center font-bold text-blue-600">{item.totalMeals}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">৳{item.payableAmount}</td>
                    </tr>
                    ))}
                    {summary.length === 0 && (
                        <tr><td colSpan={5} className="text-center p-8 text-slate-500">No data found for this month.</td></tr>
                    )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                        <td colSpan={4} className="px-6 py-4 font-bold text-slate-700 text-right uppercase text-xs tracking-wider">Grand Total</td>
                        <td className="px-6 py-4 font-bold text-green-700 text-right text-lg">৳{grandTotal}</td>
                    </tr>
                </tfoot>
                </table>
            </div>
            </>
        )}
      </div>
    </div>
  );
};
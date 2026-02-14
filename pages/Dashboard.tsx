import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Users, Utensils, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { AppSettings, DailyMealDoc } from '../types';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeMembers: 0,
    todayMeals: 0,
    todayIncome: 0,
    monthIncome: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const currentMonthPrefix = format(new Date(), 'yyyy-MM');

        // 1. Get Settings (Price)
        const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
        const price = settingsSnap.exists() ? (settingsSnap.data() as AppSettings).mealPrice : 65;

        // 2. Active Members
        const membersQuery = query(collection(db, 'members'), where('status', '==', 'active'));
        const membersSnap = await getDocs(membersQuery);
        const activeMembers = membersSnap.size;

        // 3. Today's Data
        const todayDoc = await getDoc(doc(db, 'meals', todayStr));
        let todayMealsCount = 0;
        if (todayDoc.exists()) {
          const data = todayDoc.data() as DailyMealDoc;
          Object.values(data.entries || {}).forEach(entry => {
            if (entry.lunch) todayMealsCount++;
            if (entry.dinner) todayMealsCount++;
          });
        }

        // 4. Monthly Income
        let monthMealsCount = 0;
        const daysInMonth = 31; 
        const monthQueryPromises = [];
        for(let i = 1; i <= daysInMonth; i++) {
           const dayStr = `${currentMonthPrefix}-${String(i).padStart(2, '0')}`;
           monthQueryPromises.push(getDoc(doc(db, 'meals', dayStr)));
        }
        
        const monthDocs = await Promise.all(monthQueryPromises);
        monthDocs.forEach(d => {
            if(d.exists()) {
                const data = d.data() as DailyMealDoc;
                Object.values(data.entries || {}).forEach(entry => {
                    if (entry.lunch) monthMealsCount++;
                    if (entry.dinner) monthMealsCount++;
                });
            }
        });

        setStats({
          activeMembers,
          todayMeals: todayMealsCount,
          todayIncome: todayMealsCount * price,
          monthIncome: monthMealsCount * price,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    { label: 'Total Members', value: stats.activeMembers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: "Today's Meals", value: stats.todayMeals, icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: "Today's Income", value: `৳${stats.todayIncome}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Month Income', value: `৳${stats.monthIncome}`, icon: Wallet, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      <p className="text-slate-500 font-medium">Loading Overview...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm md:text-base">Overview of your mess activity</p>
        </div>
        <div className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full w-fit">
           {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm border ${card.border} flex flex-col justify-between h-32 md:h-auto`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-500 font-medium uppercase tracking-wide">{card.label}</p>
                <h3 className="text-xl md:text-3xl font-bold text-slate-800 mt-1 md:mt-2">{card.value}</h3>
              </div>
              <div className={`p-2 md:p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`h-5 w-5 md:h-6 md:w-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-2xl shadow-lg text-white">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
           <a href="#/meals" className="flex-1 min-w-[140px] px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl hover:bg-white/20 transition flex items-center justify-center gap-2 font-medium">
             <Utensils className="h-4 w-4" /> Add Meals
           </a>
           <a href="#/members" className="flex-1 min-w-[140px] px-4 py-3 bg-white text-red-700 rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-2 font-bold shadow-sm">
             <Users className="h-4 w-4" /> Add Member
           </a>
        </div>
      </div>
    </div>
  );
};
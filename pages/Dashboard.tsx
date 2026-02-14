import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Users, DollarSign, Utensils, TrendingUp } from 'lucide-react';
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
        // In a real app with huge data, we would use an aggregation or separate summary collection.
        // For a simple app, fetching one month of docs is fine.
        let monthMealsCount = 0;
        // Optimization: querying by string prefix is tricky in standard Firestore without specific range.
        // We will just fetch all for the month since max 31 docs.
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
    { label: 'Active Members', value: stats.activeMembers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: "Today's Meals", value: stats.todayMeals, icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: "Today's Income", value: `৳${stats.todayIncome}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Month Income', value: `৳${stats.monthIncome}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500">Welcome back, Admin</p>
        </div>
        <div className="text-sm text-slate-400">
           {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-hover hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
            <p className="text-sm text-slate-500 font-medium">{card.label}</p>
          </div>
        ))}
      </div>
      
      {/* Quick Visual Placeholder */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex gap-4">
           <a href="#/meals" className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">Enter Today's Meals</a>
           <a href="#/members" className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition">Manage Members</a>
        </div>
      </div>
    </div>
  );
};
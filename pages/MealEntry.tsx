import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Button } from '../components/Button';
import { Calendar as CalendarIcon, Save } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings } from '../types';

export const MealEntry: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Record<string, { lunch: boolean; dinner: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(65);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get Active Members
      const mQuery = query(collection(db, 'members'), where('status', '==', 'active'));
      const mSnap = await getDocs(mQuery);
      const activeMembers = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(activeMembers);

      // 2. Get Existing Entries for Date
      const mealDocRef = doc(db, 'meals', selectedDate);
      const mealDoc = await getDoc(mealDocRef);
      
      const currentEntries: Record<string, { lunch: boolean; dinner: boolean }> = {};
      
      if (mealDoc.exists()) {
        const data = mealDoc.data() as DailyMealDoc;
        activeMembers.forEach(m => {
          currentEntries[m.id] = data.entries[m.id] || { lunch: false, dinner: false };
        });
      } else {
        // Initialize defaults
        activeMembers.forEach(m => {
          currentEntries[m.id] = { lunch: false, dinner: false };
        });
      }
      setEntries(currentEntries);

      // 3. Get Price (for display calculations)
      const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
      if(settingsSnap.exists()) {
          setPrice((settingsSnap.data() as AppSettings).mealPrice);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleMeal = (memberId: string, type: 'lunch' | 'dinner') => {
    setEntries(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [type]: !prev[memberId][type]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'meals', selectedDate);
      await setDoc(docRef, {
        date: selectedDate,
        entries: entries
      }, { merge: true });
      alert('Meals saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save meals.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals for UI
  const totalMeals = Object.values(entries).reduce<number>((acc, curr) => acc + (curr.lunch ? 1 : 0) + (curr.dinner ? 1 : 0), 0);
  const totalCost = totalMeals * price;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Meal Entry</h2>
          <p className="text-slate-500">Mark lunch and dinner for members</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <CalendarIcon className="h-5 w-5 text-slate-500 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="outline-none text-slate-700 font-medium bg-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="text-sm font-medium text-slate-600">
                Total Meals: <span className="text-slate-900 font-bold">{totalMeals}</span>
                <span className="mx-3 text-slate-300">|</span>
                Estimated Cost: <span className="text-green-600 font-bold">৳{totalCost}</span>
            </div>
            <Button onClick={handleSave} isLoading={saving} className="text-sm py-1">
                <Save className="h-4 w-4" /> Save Changes
            </Button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500 font-semibold">
                  <th className="px-6 py-4">Member Name</th>
                  <th className="px-6 py-4 text-center">Lunch</th>
                  <th className="px-6 py-4 text-center">Dinner</th>
                  <th className="px-6 py-4 text-center">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(member => {
                  const entry = entries[member.id] || { lunch: false, dinner: false };
                  return (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {member.fullName}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={entry.lunch}
                            onChange={() => toggleMeal(member.id, 'lunch')}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={entry.dinner}
                            onChange={() => toggleMeal(member.id, 'dinner')}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                        {(entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Button } from '../components/Button';
import { Calendar as CalendarIcon, Save, Moon, Sun } from 'lucide-react';
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
      const mQuery = query(collection(db, 'members'), where('status', '==', 'active'));
      const mSnap = await getDocs(mQuery);
      const activeMembers = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(activeMembers);

      const mealDocRef = doc(db, 'meals', selectedDate);
      const mealDoc = await getDoc(mealDocRef);
      
      const currentEntries: Record<string, { lunch: boolean; dinner: boolean }> = {};
      
      if (mealDoc.exists()) {
        const data = mealDoc.data() as DailyMealDoc;
        activeMembers.forEach(m => {
          currentEntries[m.id] = data.entries[m.id] || { lunch: false, dinner: false };
        });
      } else {
        activeMembers.forEach(m => {
          currentEntries[m.id] = { lunch: false, dinner: false };
        });
      }
      setEntries(currentEntries);

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
      // Use simple alert or toast
      // alert('Saved!'); 
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const totalMeals = Object.values(entries).reduce<number>((acc, curr: { lunch: boolean; dinner: boolean }) => acc + (curr.lunch ? 1 : 0) + (curr.dinner ? 1 : 0), 0);
  const totalCost = totalMeals * price;

  // Toggle Component for Mobile
  const MealToggle = ({ active, onClick, icon: Icon, colorClass, label }: any) => (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 active:scale-95
        ${active 
          ? `${colorClass} border-transparent shadow-sm` 
          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
        }`}
    >
      <Icon className={`h-6 w-6 ${active ? 'fill-current' : ''}`} />
      <span className="text-xs font-bold uppercase">{label}</span>
    </button>
  );

  return (
    <div className="pb-24 md:pb-0 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 sticky top-[60px] md:static z-20 bg-slate-50 py-2 md:py-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Meal Entry</h2>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-red-100 shadow-sm w-full md:w-auto">
          <CalendarIcon className="h-5 w-5 text-red-500 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="outline-none text-slate-800 font-bold bg-transparent flex-1 text-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(member => {
                const entry = entries[member.id] || { lunch: false, dinner: false };
                return (
                    <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-3">
                             <span className="font-bold text-slate-800 text-lg">{member.fullName}</span>
                             <div className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded">
                                 Total: {(entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0)}
                             </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <MealToggle 
                                active={entry.lunch} 
                                onClick={() => toggleMeal(member.id, 'lunch')}
                                icon={Sun}
                                label="Lunch"
                                colorClass="bg-amber-100 text-amber-700 border-amber-200"
                            />
                            <MealToggle 
                                active={entry.dinner} 
                                onClick={() => toggleMeal(member.id, 'dinner')}
                                icon={Moon}
                                label="Dinner"
                                colorClass="bg-indigo-100 text-indigo-700 border-indigo-200"
                            />
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {/* Sticky Bottom Bar for Mobile & Desktop */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 flex justify-between items-center">
         <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium uppercase">Summary</span>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">{totalMeals}</span>
                <span className="text-sm text-slate-400">meals</span>
            </div>
            <span className="text-xs font-bold text-red-600">৳{totalCost}</span>
         </div>
         <Button onClick={handleSave} isLoading={saving} className="px-8 py-3 rounded-xl shadow-red-200 text-base">
            <Save className="h-5 w-5" />
            Save Data
         </Button>
      </div>
    </div>
  );
};
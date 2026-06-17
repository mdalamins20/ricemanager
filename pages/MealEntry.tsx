
import React, { useEffect, useState, useCallback } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { format } from 'date-fns';
import { Button } from '../components/Button';
import { CalendarDays, Save, MoonStar, SunMedium, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings } from '../types';
import { logAction } from '../utils/logger';

export const MealEntry: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(65);
  const [user, setUser] = useState<firebase.User | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const mSnap = await db.collection('members').where('status', '==', 'active').get();
      const activeMembers = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(activeMembers);

      const mealDoc = await db.collection('meals').doc(selectedDate).get();
      
      const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }> = {};
      
      if (mealDoc.exists) {
        const data = mealDoc.data() as DailyMealDoc;
        activeMembers.forEach(m => {
          currentEntries[m.id] = data.entries[m.id] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
        });
      } else {
        activeMembers.forEach(m => {
          currentEntries[m.id] = { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
        });
      }
      setEntries(currentEntries);

      const settingsSnap = await db.collection('settings').doc('config').get();
      if(settingsSnap.exists) {
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

  const updateGuest = async (memberId: string, type: 'guestLunch' | 'guestDinner', count: number) => {
    if (!user) return;
    
    const newEntries = {
      ...entries,
      [memberId]: {
        ...entries[memberId],
        [type]: count
      }
    };
    
    setEntries(newEntries);

    try {
      await db.collection('meals').doc(selectedDate).set({
        date: selectedDate,
        entries: newEntries
      }, { merge: true });
    } catch (err) {
      console.error("Auto-save error:", err);
      showToast('error', 'Guest update failed.');
    }
  };

  const toggleMeal = async (memberId: string, type: 'lunch' | 'dinner') => {
    if (!user) return;
    
    const newEntries = {
      ...entries,
      [memberId]: {
        ...entries[memberId],
        [type]: !entries[memberId][type]
      }
    };
    
    setEntries(newEntries);

    try {
      const docRef = db.collection('meals').doc(selectedDate);
      await docRef.set({
        date: selectedDate,
        entries: newEntries
      }, { merge: true });
    } catch (err) {
      console.error("Auto-save error:", err);
      showToast('error', 'Auto-save failed.');
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
      setToast({ show: true, type, message });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const docRef = db.collection('meals').doc(selectedDate);
      await docRef.set({
        date: selectedDate,
        entries: entries
      }, { merge: true });
      
      await logAction('Meal Entry', `Updated meals for ${selectedDate}`);
      showToast('success', 'Meals saved successfully!');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save meals. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalLunch = Object.values(entries).reduce((acc, curr) => acc + (curr.lunch ? 1 : 0) + (curr.guestLunch || 0), 0);
  const totalDinner = Object.values(entries).reduce((acc, curr) => acc + (curr.dinner ? 1 : 0) + (curr.guestDinner || 0), 0);
  const totalMeals = totalLunch + totalDinner;
  const totalCost = totalMeals * price;

   // Toggle Component for Mobile
   const GuestSelector = ({ count, onChange, disabled }: any) => (
     <div className="flex items-center gap-1 mt-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">Guest</span>
        <select 
          disabled={disabled}
          value={count}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer appearance-none text-center"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <option key={n} value={n} className="bg-white dark:bg-slate-800">{n} Person{n !== 1 ? 's' : ''}</option>
          ))}
        </select>
        <div className="mr-2 pointer-events-none">
           <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
           </svg>
        </div>
     </div>
   );

  const MealToggle = ({ active, onClick, icon: Icon, colorClass, label, disabled, guestCount, onGuestChange }: any) => (
    <div className="flex-1 flex flex-col">
        <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex flex-col items-center justify-center gap-1 p-2 sm:p-3 rounded-2xl border transition-all duration-200 
            ${active 
            ? `${colorClass} border-transparent shadow-md` 
            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500'}
            ${!disabled && 'active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}
            ${disabled && 'opacity-90 cursor-default'}
            `}
        >
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${active ? 'fill-current stroke-[2px]' : 'stroke-[1.5px]'}`} />
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{label}</span>
        </button>
        <GuestSelector count={guestCount || 0} onChange={onGuestChange} disabled={disabled} />
    </div>
  );

  return (
    <div className="pb-48 md:pb-24 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8 sticky top-[60px] md:static z-20 bg-slate-50 dark:bg-[#0f172a] py-2 md:py-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            Daily Meal Entry
            {!user && <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md font-bold uppercase">Read Only</span>}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Mark meals for {format(new Date(selectedDate), 'MMMM do, yyyy')}</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-4 rounded-xl border border-red-100 dark:border-red-900/40 shadow-sm w-full md:w-auto ring-4 ring-red-50 dark:ring-red-900/10">
          <CalendarDays className="h-5 w-5 text-red-500 dark:text-red-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="outline-none text-slate-800 dark:text-white font-bold bg-transparent flex-1 text-lg uppercase cursor-pointer"
          />
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(member => {
                const entry = entries[member.id] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
                return (
                    <div key={member.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-3">
                               <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                                  {member.fullName.charAt(0)}
                               </div>
                               <span className="font-bold text-slate-800 dark:text-white text-lg">{member.fullName}</span>
                             </div>
                             <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                 Total: {(entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (entry.guestLunch || 0) + (entry.guestDinner || 0)}
                             </div>
                        </div>
                        
                        <div className="flex gap-2 sm:gap-4">
                            <MealToggle 
                                active={entry.lunch} 
                                onClick={() => toggleMeal(member.id, 'lunch')}
                                icon={SunMedium}
                                label="Lunch"
                                disabled={!user}
                                colorClass="bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-200 dark:shadow-none"
                                guestCount={entry.guestLunch}
                                onGuestChange={(count: number) => updateGuest(member.id, 'guestLunch', count)}
                            />
                            <MealToggle 
                                active={entry.dinner} 
                                onClick={() => toggleMeal(member.id, 'dinner')}
                                icon={MoonStar}
                                label="Dinner"
                                disabled={!user}
                                colorClass="bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-200 dark:shadow-none"
                                guestCount={entry.guestDinner}
                                onGuestChange={(count: number) => updateGuest(member.id, 'guestDinner', count)}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
      

      {/* Sticky Bottom Bar for Mobile & Desktop */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-3 md:p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-30 flex justify-center items-center">
         <div className="flex items-center gap-4 md:gap-10">
              <div className="flex flex-col items-center px-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Lunch</span>
                  <span className="text-base md:text-xl font-bold text-amber-600 dark:text-amber-500">{totalLunch}</span>
              </div>
              <div className="flex flex-col items-center px-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dinner</span>
                  <span className="text-base md:text-xl font-bold text-indigo-600 dark:text-indigo-500">{totalDinner}</span>
              </div>
              <div className="flex flex-col items-center px-3 border-x border-slate-100 dark:border-slate-800 mx-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total</span>
                  <span className="text-base md:text-xl font-bold text-slate-900 dark:text-white">{totalMeals}</span>
              </div>
              <div className="flex flex-col items-center px-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Cost</span>
                  <span className="text-base md:text-xl font-bold text-red-600 dark:text-red-500">৳{totalCost}</span>
              </div>
          </div>
      </div>

      {/* Custom Toast Notification */}
      {toast.show && (
         <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-red-100 text-red-800'}`}>
            <div className={`p-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
               {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
               <p className="font-bold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
               <p className="text-xs opacity-80">{toast.message}</p>
            </div>
         </div>
      )}
    </div>
  );
};

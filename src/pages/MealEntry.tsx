
import React, { useEffect, useState, useCallback } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../components/Button';
import { CalendarDays, Save, MoonStar, SunMedium, Lock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, UsersRound } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings } from '../types';
import { logAction } from '../utils/logger';
import { useMembers, useMeals, useSettings } from '../contexts';

export const MealEntry: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(65);
  const [user, setUser] = useState<firebase.User | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' });

  // Strict future date prevention
  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (selectedDate > todayStr) {
      setSelectedDate(todayStr);
    }
  }, [selectedDate]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const { members: allMembers, loading: membersLoading } = useMembers();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { settings, loading: settingsLoading } = useSettings();
  const dataLoading = membersLoading || mealsLoading || settingsLoading;
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);

  useEffect(() => {
    setActiveMembers(allMembers.filter(m => m.status === 'active'));
  }, [allMembers]);

  const fetchData = useCallback(async () => {
    if (dataLoading) return;
    setLoading(true);
    
    try {
      const mealDoc = allMeals.find(m => m.date === selectedDate);
      const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }> = {};
      
      if (mealDoc) {
        activeMembers.forEach(m => {
          currentEntries[m.id] = mealDoc.entries?.[m.id] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
        });
      } else {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        if (selectedDate >= todayStr) {
            // Auto-populate for today and future dates
            activeMembers.forEach(m => {
              const defaultMeals = m.defaultMeals || { lunch: true, dinner: true };
              currentEntries[m.id] = { lunch: defaultMeals.lunch, dinner: defaultMeals.dinner, guestLunch: 0, guestDinner: 0 };
            });
            
            // Auto-save this initial configuration to the database if the user is authenticated
            const currentUser = auth.currentUser;
            if (currentUser && activeMembers.length > 0) {
                try {
                    await db.collection('meals').doc(selectedDate).set({
                        date: selectedDate,
                        entries: currentEntries
                    }, { merge: true });
                } catch (saveErr) {
                    console.error("Auto-init save error:", saveErr);
                }
            }
        } else {
            // For past dates that don't exist in DB, just show 0 meals (no auto-population)
            activeMembers.forEach(m => {
              currentEntries[m.id] = { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
            });
        }
      }
      setEntries(currentEntries);
      setPrice(settings?.mealPrice || 65);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, dataLoading, allMeals, activeMembers, settings]);

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

  const handlePrevDay = () => {
    const prev = subDays(new Date(selectedDate), 1);
    setSelectedDate(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const next = addDays(new Date(selectedDate), 1);
    const nextStr = format(next, 'yyyy-MM-dd');
    if (nextStr <= todayStr) {
      setSelectedDate(nextStr);
    }
  };

  const totalLunch = Object.values(entries).reduce((acc, curr) => acc + (curr.lunch ? 1 : 0) + (curr.guestLunch || 0), 0);
  const totalDinner = Object.values(entries).reduce((acc, curr) => acc + (curr.dinner ? 1 : 0) + (curr.guestDinner || 0), 0);
  const totalGuests = Object.values(entries).reduce((acc, curr) => acc + (curr.guestLunch || 0) + (curr.guestDinner || 0), 0);
  const totalMeals = totalLunch + totalDinner;
  const totalCost = totalMeals * price;

   // Toggle Component for Mobile
   const GuestSelector = ({ count, onChange, disabled }: any) => (
     <div className="flex items-center justify-between mt-2 bg-slate-50 dark:bg-slate-900/40 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm w-full">
        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
           Guest
        </span>
        <div className="relative">
            <select 
              disabled={disabled}
              value={count}
              onChange={(e) => onChange(Number(e.target.value))}
              className="pl-2.5 pr-6 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md outline-none text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer appearance-none shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-colors"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
               <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
               </svg>
            </div>
        </div>
     </div>
   );

  const MealToggle = ({ active, onClick, icon: Icon, colorClass, label, disabled, guestCount, onGuestChange }: any) => (
    <div className="flex-1 flex flex-col min-w-0">
        <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex flex-col items-center justify-center gap-1.5 p-2 sm:p-2.5 rounded-2xl border transition-all duration-300 
            ${active 
            ? `${colorClass} border-transparent shadow-lg transform active:scale-95` 
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 shadow-sm'}
            ${!disabled && !active && 'hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95'}
            ${disabled && 'opacity-70 cursor-default'}
            `}
        >
        <Icon className={`h-5 w-5 ${active ? 'fill-current stroke-[2px]' : 'stroke-[1.5px]'}`} />
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">{label}</span>
        </button>
        <GuestSelector count={guestCount || 0} onChange={onGuestChange} disabled={disabled} />
    </div>
  );

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-none flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3 flex-wrap">
            Daily Meal Entry
            {!user && <span className="text-[10px] md:text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md font-bold uppercase">Read Only</span>}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Mark meals for {format(new Date(selectedDate), 'MMMM do, yyyy')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handlePrevDay} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-800 p-2 px-2 sm:px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm w-full md:w-auto ring-4 ring-emerald-50 dark:ring-emerald-900/10">
            <CalendarDays className="h-5 w-5 text-emerald-500 dark:text-emerald-400 hidden sm:block" />
            <input
              type="date"
              max={format(new Date(), 'yyyy-MM-dd')}
              value={selectedDate}
              onChange={(e) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const val = e.target.value;
                if (!val) return; // ignore empty
                if (val > todayStr) {
                  // User tried to pick future date, force to today
                  setSelectedDate(todayStr);
                  showToast('error', 'Future dates are not allowed!');
                } else {
                  setSelectedDate(val);
                }
              }}
              className="outline-none text-slate-800 dark:text-white font-bold bg-transparent flex-1 text-sm sm:text-lg uppercase cursor-pointer text-center"
            />
          </div>
          {selectedDate < format(new Date(), 'yyyy-MM-dd') && (
            <button onClick={handleNextDay} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
              <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 md:pb-10 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6 mb-8">
        {activeMembers.map((member: Member) => {
                const entry = entries[member.id] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
                return (
                    <div key={member.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-3">
                               <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 shrink-0 overflow-hidden">
                                  {member.photoBase64 ? (
                                     <img src={member.photoBase64} alt={member.fullName} className="h-full w-full object-cover" />
                                  ) : (
                                     member.fullName.charAt(0)
                                  )}
                               </div>
                               <div className="flex flex-col">
                                   <span className="font-bold text-slate-800 dark:text-white text-lg leading-tight">{member.fullName}</span>
                                   <div className="flex items-center gap-1 mt-0.5 opacity-80" title="Auto Meal Settings">
                                      <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Auto:</span>
                                      {(member.defaultMeals?.lunch ?? true) && <SunMedium className="h-3 w-3 text-amber-500" />}
                                      {(member.defaultMeals?.dinner ?? true) && <MoonStar className="h-3 w-3 text-emerald-500" />}
                                      {!(member.defaultMeals?.lunch ?? true) && !(member.defaultMeals?.dinner ?? true) && <span className="text-[9px] font-bold text-slate-400">None</span>}
                                   </div>
                               </div>
                             </div>
                             <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                 Total: {(entry.lunch ? 1 : 0) + (entry.dinner ? 1 : 0) + (entry.guestLunch || 0) + (entry.guestDinner || 0)}
                             </div>
                        </div>
                        
                        <div className="flex gap-2 sm:gap-3">
                            <MealToggle 
                                active={entry.lunch} 
                                onClick={() => toggleMeal(member.id, 'lunch')}
                                icon={SunMedium}
                                label="Lunch"
                                disabled={!user}
                                colorClass="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20 border-emerald-400/20"
                                guestCount={entry.guestLunch}
                                onGuestChange={(count: number) => updateGuest(member.id, 'guestLunch', count)}
                            />
                            <MealToggle 
                                active={entry.dinner} 
                                onClick={() => toggleMeal(member.id, 'dinner')}
                                icon={MoonStar}
                                label="Dinner"
                                disabled={!user}
                                colorClass="bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-200/50 dark:shadow-teal-900/20 border-teal-400/20"
                                guestCount={entry.guestDinner}
                                onGuestChange={(count: number) => updateGuest(member.id, 'guestDinner', count)}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
      

      {/* Sticky Bottom Bar for Mobile & Desktop */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-3 md:p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-30 flex justify-center md:justify-between items-center px-2 md:px-8 flex-wrap gap-2 transition-all">
         
         <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
             <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                 <UsersRound className="h-4 w-4" />
             </div>
             <div className="flex flex-col">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Members</span>
                 <span className="text-sm font-bold text-slate-800 dark:text-white">{activeMembers.length} Members</span>
             </div>
         </div>

         <div className="flex items-center gap-2 sm:gap-4 md:gap-8 overflow-x-auto no-scrollbar w-full md:w-auto justify-center">
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Lunch</span>
                  <span className="text-sm sm:text-base md:text-xl font-black text-amber-600 dark:text-amber-500">{totalLunch}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dinner</span>
                  <span className="text-sm sm:text-base md:text-xl font-black text-emerald-600 dark:text-emerald-500">{totalDinner}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2 border-l border-slate-100 dark:border-slate-800 ml-1 pl-2 sm:pl-4">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Guests</span>
                  <span className="text-sm sm:text-base md:text-xl font-black text-rose-500 dark:text-rose-400">{totalGuests}</span>
              </div>
              <div className="flex flex-col items-center px-2 sm:px-3 border-x border-slate-100 dark:border-slate-800 mx-1 sm:mx-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Meals</span>
                  <span className="text-sm sm:text-base md:text-xl font-black text-slate-900 dark:text-white">{totalMeals}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Est. Cost</span>
                  <span className="text-sm sm:text-base md:text-xl font-black text-emerald-600 dark:text-emerald-500">৳{totalCost}</span>
              </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm">
              <CheckCircle2 className="h-4 w-4 stroke-[2.5px]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Auto Saved</span>
          </div>
      </div>

      {/* Custom Toast Notification */}
      {toast.show && (
         <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-emerald-100 text-emerald-800'}`}>
            <div className={`p-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-100 text-emerald-600'}`}>
               {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
               <p className="font-bold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
               <p className="text-xs opacity-80">{toast.message}</p>
            </div>
         </div>
      )}
      </div>
    </div>
  );
};

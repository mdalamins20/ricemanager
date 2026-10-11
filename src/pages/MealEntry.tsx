
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../components/Button';
import { CalendarDays, Save, MoonStar, SunMedium, Lock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, UsersRound } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings } from '../types';
import { logAction } from '../utils/logger';
import { useMembers, useMeals, useSettings } from '../contexts';
import { getMealRateForMonth, calculateMealCost } from '../utils/pricing';

export const MealEntry: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }>>({});
  const [notes, setNotes] = useState<{ id: string; text: string; timestamp: string; }[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);

  // Toast State with cleanup ref
  const [toast, setToast] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' });
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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
  const activeMembers = useMemo(() => allMembers.filter(m => m.status === 'active'), [allMembers]);

  const price = useMemo(() => getMealRateForMonth(settings, selectedDate.slice(0, 7)), [settings, selectedDate]);

  // Real-time direct snapshot listener for the selected date document.
  // This provides instant sub-second sync between Mobile and Desktop and avoids full-collection race conditions.
  useEffect(() => {
    if (dataLoading) return;
    setLoading(true);

    const docRef = db.collection('meals').doc(selectedDate);
    const unsubscribe = docRef.onSnapshot((docSnap) => {
      const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch?: number; guestDinner?: number }> = {};
      
      if (docSnap.exists) {
        const mealDoc = { id: docSnap.id, ...docSnap.data() } as DailyMealDoc;
        setNotes(mealDoc.notes || []);
        activeMembers.forEach(m => {
          const entry = mealDoc.entries?.[m.id];
          currentEntries[m.id] = {
            lunch: entry?.lunch ?? false,
            dinner: entry?.dinner ?? false,
            guestLunch: Number(entry?.guestLunch) || 0,
            guestDinner: Number(entry?.guestDinner) || 0
          };
        });
      } else {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        setNotes([]);
        if (selectedDate >= todayStr) {
          // Preview default meals in UI state without modifying Firestore in the background
          activeMembers.forEach(m => {
            currentEntries[m.id] = {
              lunch: m.defaultMeals?.lunch ?? true,
              dinner: m.defaultMeals?.dinner ?? true,
              guestLunch: 0,
              guestDinner: 0
            };
          });
        } else {
          // Past dates: default to 0
          activeMembers.forEach(m => {
            currentEntries[m.id] = { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
          });
        }
      }
      setEntries(currentEntries);
      setLoading(false);
    }, (err) => {
      console.error("Meal document listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, dataLoading, activeMembers]);

  // Atomic member update: updates ONLY the specific member's entry in Firestore,
  // preventing Desktop and Mobile from ever overwriting each other's changes.
  const saveMemberEntry = async (memberId: string, updatedMemberEntry: any, allNewEntries: Record<string, any>) => {
    const docRef = db.collection('meals').doc(selectedDate);
    try {
      await docRef.update({
        [`entries.${memberId}`]: updatedMemberEntry
      });
    } catch (err: any) {
      if (err.code === 'not-found' || err.message?.includes('No document to update')) {
        await docRef.set({
          date: selectedDate,
          entries: allNewEntries
        }, { merge: true });
      } else {
        throw err;
      }
    }
  };

  const updateGuest = async (memberId: string, type: 'guestLunch' | 'guestDinner', count: number) => {
    if (!user) return;
    
    const currentMemberEntry = entries[memberId] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
    const updatedMemberEntry = {
      ...currentMemberEntry,
      [type]: count
    };
    const newEntries = {
      ...entries,
      [memberId]: updatedMemberEntry
    };
    
    setEntries(newEntries);

    try {
      await saveMemberEntry(memberId, updatedMemberEntry, newEntries);
    } catch (err) {
      console.error("Auto-save error:", err);
      showToast('error', 'Guest update failed.');
      setEntries(entries);
    }
  };

  const toggleMeal = async (memberId: string, type: 'lunch' | 'dinner') => {
    if (!user) return;
    
    const currentMemberEntry = entries[memberId] || { lunch: false, dinner: false, guestLunch: 0, guestDinner: 0 };
    const updatedMemberEntry = {
      ...currentMemberEntry,
      [type]: !currentMemberEntry[type]
    };
    const newEntries = {
      ...entries,
      [memberId]: updatedMemberEntry
    };
    
    setEntries(newEntries);

    try {
      await saveMemberEntry(memberId, updatedMemberEntry, newEntries);
    } catch (err) {
      console.error("Auto-save error:", err);
      showToast('error', 'Auto-save failed.');
      setEntries(entries);
    }
  };

  const handleAddNote = async () => {
    if (!user || !newNote.trim()) return;
    const noteObj = {
      id: Date.now().toString(),
      text: newNote.trim(),
      timestamp: new Date().toISOString()
    };
    const updatedNotes = [...notes, noteObj];
    setNotes(updatedNotes);
    setNewNote('');
    setShowNoteInput(false);
    
    try {
      await db.collection('meals').doc(selectedDate).set({
        date: selectedDate,
        notes: updatedNotes
      }, { merge: true });
      showToast('success', 'Note added successfully');
    } catch (err) {
      console.error("Save note error:", err);
      showToast('error', 'Failed to add note.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    try {
      await db.collection('meals').doc(selectedDate).set({
        date: selectedDate,
        notes: updatedNotes
      }, { merge: true });
    } catch (err) {
      console.error("Delete note error:", err);
      showToast('error', 'Failed to delete note.');
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, type, message });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
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
      
      logAction('Meal Entry', `Updated meals for ${selectedDate}`).catch(console.error);
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
  const totalCost = calculateMealCost(totalMeals, price);

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
      <div className="flex-none flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 sm:py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2.5 flex-wrap">
            Daily Meal Entry
            {!user && <span className="text-[9px] md:text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold uppercase">Read Only</span>}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Mark meals for {format(new Date(selectedDate), 'MMMM do, yyyy')}</p>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto">
          <button onClick={handlePrevDay} className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-90 transition-all shadow-sm shrink-0">
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 py-2 px-3 sm:px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm flex-1 md:flex-auto ring-2 ring-emerald-500/10">
            <CalendarDays className="h-4 w-4 text-emerald-500 shrink-0" />
            <input
              type="date"
              max={format(new Date(), 'yyyy-MM-dd')}
              value={selectedDate}
              onChange={(e) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const val = e.target.value;
                if (!val) return; // ignore empty
                if (val > todayStr) {
                  setSelectedDate(todayStr);
                  showToast('error', 'Future dates are not allowed!');
                } else {
                  setSelectedDate(val);
                }
              }}
              className="outline-none text-slate-800 dark:text-white font-bold bg-transparent text-xs sm:text-base uppercase cursor-pointer text-center w-full"
            />
          </div>
          <button 
            type="button"
            onClick={handleNextDay} 
            disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}
            className={`h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm shrink-0 ${
              selectedDate >= format(new Date(), 'yyyy-MM-dd')
                ? 'opacity-25 cursor-not-allowed text-slate-300 dark:text-slate-600 pointer-events-none' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:scale-90 cursor-pointer'
            }`}
            title={selectedDate >= format(new Date(), 'yyyy-MM-dd') ? "Cannot navigate to future date" : "Next Day"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-36 md:pb-16 space-y-4 md:space-y-6">
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
        
        {/* Daily Notes Section */}
        <div className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-shadow">
           <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-500 shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                   </div>
                   <div>
                       <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Daily Notes</h3>
                       <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Remarks for {format(new Date(selectedDate), 'MMM do')}</p>
                   </div>
               </div>
               <button 
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  disabled={!user}
                  className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-100 dark:border-emerald-800/50 active:scale-95"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
               </button>
           </div>
           
           {showNoteInput && (
             <div className="mb-6 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
               <textarea
                   value={newNote}
                   onChange={(e) => setNewNote(e.target.value)}
                   disabled={!user}
                   placeholder="Write your note here..."
                   className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-900/20 transition-all resize-y min-h-[100px]"
               />
               <div className="flex justify-end gap-2">
                  <button onClick={() => {setShowNoteInput(false); setNewNote('');}} className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                  <button onClick={handleAddNote} className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-sm shadow-emerald-200 dark:shadow-emerald-900/20">Save Note</button>
               </div>
             </div>
           )}

           <div className="flex flex-col gap-3">
              {notes.length === 0 ? (
                 <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">No notes for this date. Click + to add.</div>
              ) : (
                 notes.map(note => (
                   <div key={note.id} className="relative group bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap pr-8 leading-relaxed">{note.text}</p>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-3 block">{format(new Date(note.timestamp), 'hh:mm a')}</span>
                      <button onClick={() => handleDeleteNote(note.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800">
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                   </div>
                 ))
              )}
           </div>
        </div>
        
              </div>

      {/* Floating Bottom Summary Bar for Mobile & Desktop - Inside Layout Bounds */}
      <div className="flex-none mt-2 sm:mt-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 py-2.5 sm:py-3 px-3 md:px-6 rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-none z-30 flex justify-between items-center transition-all">
         
         <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 px-3.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
             <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                 <UsersRound className="h-4 w-4" />
             </div>
             <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Active Members</span>
                 <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{activeMembers.length} Members</span>
             </div>
         </div>

         <div className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar w-full md:w-auto justify-center">
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Lunch</span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-amber-600 dark:text-amber-500">{totalLunch}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dinner</span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-emerald-600 dark:text-emerald-500">{totalDinner}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2 border-l border-slate-200/60 dark:border-slate-700/60 ml-1 pl-2 sm:pl-3">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Guests</span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-rose-500 dark:text-rose-400">{totalGuests}</span>
              </div>
              <div className="flex flex-col items-center px-2 sm:px-3 border-x border-slate-200/60 dark:border-slate-700/60 mx-1">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Meals</span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white">{totalMeals}</span>
              </div>
              <div className="flex flex-col items-center px-1 sm:px-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Est. Cost</span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-emerald-600 dark:text-emerald-500">৳{totalCost}</span>
              </div>
         </div>
         
         <div className="hidden md:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm shrink-0">
             <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5px]" />
             <span className="text-[9px] font-black uppercase tracking-widest">Auto Saved</span>
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
  );
};

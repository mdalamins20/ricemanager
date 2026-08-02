import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { Button } from '../components/Button';
import { Save, Sliders, Coins, Activity, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AppSettings, LogEntry, Member } from '../types';
import { logAction } from '../utils/logger';
import { format } from 'date-fns';

export const Settings: React.FC = () => {
  const [price, setPrice] = useState<number>(65);
  const [messName, setMessName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'data' | 'auto_meals'>('general');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = db.collection('settings').doc('config');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data() as AppSettings;
          setPrice(data.mealPrice);
          setMessName(data.messName || 'RiceMgr');
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Fetch logs when switching to logs tab
  useEffect(() => {
    if (activeTab === 'logs') {
      const fetchLogs = async () => {
        try {
          const snapshot = await db.collection('logs').orderBy('timestamp', 'desc').limit(50).get();
          const logData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry));
          setLogs(logData);
        } catch (error) {
          console.error("Error fetching logs:", error);
        }
      };
      fetchLogs();
    } else if (activeTab === 'auto_meals') {
      const fetchMembers = async () => {
        try {
          const snapshot = await db.collection('members').where('status', '==', 'active').get();
          let mems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member));
          mems.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setMembers(mems);
        } catch (error) {
          console.error("Error fetching members:", error);
        }
      };
      fetchMembers();
    }
  }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      await db.collection('settings').doc('config').set({
        mealPrice: Number(price),
        messName: messName
      }, { merge: true });
      await logAction('Update Settings', `Updated settings (Price: ${price}, Name: ${messName})`);
      setNotification({ type: 'success', message: 'Settings updated successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
      // Simple export as JSON (can be expanded to CSV)
      const data = {
          settings: { mealPrice: price, messName },
          exportTime: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ricemanager_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const toggleAutoMeal = (memberId: string, type: 'lunch' | 'dinner') => {
      setMembers(prev => prev.map(m => {
          if (m.id === memberId) {
              const currentDefault = m.defaultMeals || { lunch: true, dinner: true };
              return { ...m, defaultMeals: { ...currentDefault, [type]: !currentDefault[type] } };
          }
          return m;
      }));
  };

  const saveAutoMeals = async () => {
      setSaving(true);
      try {
          const batch = db.batch();
          members.forEach(m => {
              const ref = db.collection('members').doc(m.id);
              batch.update(ref, { defaultMeals: m.defaultMeals || { lunch: true, dinner: true } });
          });
          await batch.commit();
          await logAction('Settings', 'Updated auto meal preferences');
          setNotification({ type: 'success', message: 'Auto meal settings saved successfully!' });
          setTimeout(() => setNotification(null), 3000);
      } catch (err) {
          console.error(err);
          setNotification({ type: 'error', message: 'Failed to save auto meal settings.' });
      } finally {
          setSaving(false);
      }
  };

  const handleReset = async () => {
      if (window.confirm('Are you sure you want to RESET all data? This will NOT delete members but WILL clear logs. (Full reset logic can be expanded)')) {
          setNotification({ type: 'success', message: 'System Reset requested. (Logic pending implementation)' });
      }
  };

  if (loading) return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      <div className="flex-none flex items-center gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
          <Sliders className="h-8 w-8 text-indigo-600 dark:text-indigo-400 stroke-[1.5px]" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure parameters & view system logs</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* Tabs */}
        <div className="flex w-full md:w-auto gap-2 mb-8 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl overflow-x-auto no-scrollbar border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'general' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
          >
            <Sliders className="h-4 w-4" /> General
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'data' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
          >
            <Activity className="h-4 w-4" /> Security
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
          >
            <Clock className="h-4 w-4" /> Logs
          </button>
          <button 
            onClick={() => setActiveTab('auto_meals')}
            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'auto_meals' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
          >
            <CheckCircle2 className="h-4 w-4" /> Auto Meals
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden">
            
            <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl pointer-events-none"></div>

            {notification && (
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${notification.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50'}`}>
                    {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    {notification.message}
                </div>
            )}

            <div className="mb-8">
               <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                   <Sliders className="h-5 w-5 text-indigo-500" /> Identity & Preferences
               </h3>
               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage core settings that define your application.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8 relative z-10">
              <div className="space-y-6 max-w-xl">
                {/* Mess Identity */}
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Mess Name</label>
                  <div className="relative">
                      <input
                        type="text"
                        required
                        value={messName}
                        onChange={(e) => setMessName(e.target.value)}
                        placeholder="Enter Mess Name"
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-lg font-bold text-slate-800 dark:text-white transition-all group-hover:border-slate-300 dark:group-hover:border-slate-600 shadow-sm"
                      />
                  </div>
                </div>

                {/* Price Config */}
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Meal Price</label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 rounded-l-2xl font-black text-slate-500 dark:text-slate-400 text-lg">
                        ৳
                    </div>
                    <input
                      type="number"
                      min="0"
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full pl-20 pr-5 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-lg font-bold text-slate-800 dark:text-white transition-all group-hover:border-slate-300 dark:group-hover:border-slate-600 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex pt-4">
                <Button type="submit" isLoading={saving} className="px-8 py-4 rounded-2xl text-base font-bold shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-[1.02]">
                  <Save className="h-5 w-5 stroke-[2.5px]" />
                  Save Preferences
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <Save className="h-5 w-5 text-emerald-500" /> Backup Data
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Download a copy of your configuration for safekeeping.</p>
                <button 
                  onClick={exportData}
                  className="w-full md:w-auto bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  Download Backup (JSON)
                </button>
             </div>

             <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 p-8">
                <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Danger Zone
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">These actions are destructive and cannot be undone.</p>
                <button 
                  onClick={handleReset}
                  className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  Reset System Data
                </button>
             </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                   <h3 className="font-bold text-slate-700 dark:text-slate-300">Recent Activity (Last 50)</h3>
                </div>
             </div>
             
             <div className="max-h-[600px] overflow-y-auto">
               {logs.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 dark:text-slate-500">No logs found.</div>
               ) : (
                 <>
                   {/* Desktop Table View */}
                   <div className="hidden md:block">
                      <table className="w-full text-left">
                        <thead className="bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                          <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <th className="px-6 py-4 uppercase">Action</th>
                            <th className="px-6 py-4 uppercase">Details</th>
                            <th className="px-6 py-4 uppercase">User</th>
                            <th className="px-6 py-4 uppercase text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {logs.map((log) => (
                            <tr key={log.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{log.action}</td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{log.details}</td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-xs">{log.performedBy}</td>
                              <td className="px-6 py-4 text-slate-400 dark:text-slate-500 text-xs text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>

                   {/* Mobile Card View */}
                   <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                      {logs.map((log) => (
                        <div key={log.id} className="p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                           <div className="flex justify-between items-start">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</span>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                                 <Clock className="h-2.5 w-2.5" />
                                 {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                              </div>
                           </div>
                           <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{log.details}</p>
                           <div className="flex items-center gap-1.5 pt-1">
                              <div className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-500 dark:text-slate-400">
                                 {log.performedBy?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">{log.performedBy}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                 </>
               )}
             </div>
          </div>
        )}

        {activeTab === 'auto_meals' && (
           <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 animate-in fade-in slide-in-from-bottom-2 relative">
             {notification && (
                <div className={`absolute top-0 left-0 right-0 p-4 rounded-t-3xl flex items-center gap-2 text-sm font-bold ${notification.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'}`}>
                    {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {notification.message}
                </div>
             )}

             <div className="mb-6 mt-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Default Auto Meals</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Configure which meals are automatically selected when opening a new day.</p>
             </div>

             <div className="space-y-3 mb-8 max-h-[500px] overflow-y-auto pr-2">
                {members.map(member => {
                    const defaultMeals = member.defaultMeals || { lunch: true, dinner: true };
                    return (
                        <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{member.fullName}</span>
                            <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => toggleAutoMeal(member.id, 'lunch')}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${defaultMeals.lunch ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                                >
                                  {defaultMeals.lunch ? 'Lunch (ON)' : 'Lunch (OFF)'}
                                </button>
                                <button 
                                  onClick={() => toggleAutoMeal(member.id, 'dinner')}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${defaultMeals.dinner ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                                >
                                  {defaultMeals.dinner ? 'Dinner (ON)' : 'Dinner (OFF)'}
                                </button>
                            </div>
                        </div>
                    );
                })}
             </div>
             <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                <Button onClick={saveAutoMeals} isLoading={saving} className="px-8 py-3.5 rounded-xl text-base font-bold shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="h-5 w-5 stroke-[2px]" />
                  Save Auto Meals
                </Button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

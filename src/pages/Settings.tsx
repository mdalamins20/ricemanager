import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { Button } from '../components/Button';
import { 
  Save, Sliders, ShieldAlert, Activity, Clock, 
  CheckCircle2, AlertTriangle, Download, Trash2, 
  Settings as SettingsIcon, Database,
  UserPlus, Edit3, Trash
} from 'lucide-react';
import { AppSettings, LogEntry, Member } from '../types';
import { logAction } from '../utils/logger';
import { format } from 'date-fns';

type Tab = 'general' | 'security' | 'logs' | 'auto_meals';

export const Settings: React.FC = () => {
  const [price, setPrice] = useState<number>(65);
  const [messName, setMessName] = useState<string>('');
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Danger Zone specific
  const [resetConfirm, setResetConfirm] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = db.collection('settings').doc('config');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data() as AppSettings;
          setPrice(data.mealPrice);
          setMessName(data.messName || 'RiceMgr');
          setYoutubeVideoUrl(data.youtubeVideoUrl || '');
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      const fetchLogs = async () => {
        try {
          const snapshot = await db.collection('logs').orderBy('timestamp', 'desc').get();
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
        messName: messName,
        youtubeVideoUrl: youtubeVideoUrl
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
      const data = {
          settings: { mealPrice: price, messName, youtubeVideoUrl },
          exportTime: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mealmanager_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
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
      if (resetConfirm !== 'RESET') {
         setNotification({ type: 'error', message: 'Please type RESET to confirm.' });
         return;
      }
      setNotification({ type: 'success', message: 'System Reset requested. (Logic pending implementation)' });
      setResetConfirm('');
  };

  const getLogIcon = (action: string) => {
      const lower = action.toLowerCase();
      if (lower.includes('add') || lower.includes('create')) return <UserPlus className="h-4 w-4" />;
      if (lower.includes('update') || lower.includes('edit')) return <Edit3 className="h-4 w-4" />;
      if (lower.includes('delete') || lower.includes('remove')) return <Trash className="h-4 w-4" />;
      if (lower.includes('login') || lower.includes('auth')) return <ShieldAlert className="h-4 w-4" />;
      return <Activity className="h-4 w-4" />;
  };

  const getLogColor = (action: string) => {
      const lower = action.toLowerCase();
      if (lower.includes('add') || lower.includes('create')) return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      if (lower.includes('update') || lower.includes('edit')) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      if (lower.includes('delete') || lower.includes('remove')) return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      if (lower.includes('login') || lower.includes('auth')) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  };

  if (loading) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading Settings...</p>
            </div>
        </div>
    );
  }

  const tabs = [
      { id: 'general', label: 'General', icon: Sliders, desc: 'Core preferences' },
      { id: 'security', label: 'Security', icon: ShieldAlert, desc: 'Backup & Reset' },
      { id: 'logs', label: 'Activity Logs', icon: Clock, desc: 'System audit trail' },
      { id: 'auto_meals', label: 'Auto Meals', icon: Activity, desc: 'Default selections' }
  ];

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Global Notification Overlay */}
      {notification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
              <div className={`px-6 py-3 rounded-full flex items-center gap-3 text-sm font-bold shadow-xl border backdrop-blur-md ${
                  notification?.type === 'success' 
                  ? 'bg-emerald-500 text-white border-emerald-400' 
                  : 'bg-rose-500 text-white border-rose-400'
              }`}>
                  {notification?.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  {notification?.message}
              </div>
          </div>
      )}

      {/* Settings Navigation Sidebar */}
      <div className="flex-none md:w-72 flex flex-col gap-2">
         {/* Page Header */}
         <div className="mb-4 md:mb-8 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
             <div className="relative z-10 flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
                     <SettingsIcon className="h-6 w-6 stroke-[2px]" />
                 </div>
                 <div>
                     <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Preferences</p>
                 </div>
             </div>
         </div>

         {/* Navigation Pills */}
         <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                <button 
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as Tab); setNotification(null); }}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 text-left shrink-0 md:shrink border ${
                      isActive 
                      ? 'bg-white dark:bg-slate-800 shadow-sm border-emerald-100 dark:border-slate-600 md:translate-x-1' 
                      : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
                        isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                        <tab.icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                    </div>
                    <div className="hidden md:block pr-2">
                        <h4 className={`font-bold text-sm tracking-wide ${isActive ? 'text-slate-800 dark:text-white' : ''}`}>{tab.label}</h4>
                        <p className={`text-[11px] font-medium mt-0.5 ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>{tab.desc}</p>
                    </div>
                </button>
            )})}
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden relative">
          <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-10 relative">
            
            {/* --- GENERAL TAB --- */}
            {activeTab === 'general' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-300 max-w-2xl">
                    <div className="mb-8">
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">General Preferences</h3>
                        <p className="text-slate-500 dark:text-slate-400">Manage the core identity and pricing rules for your mess.</p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="space-y-6">
                            {/* Meal Price */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                    Default Meal Price (৳)
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold text-lg">৳</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={price}
                                        onChange={(e) => setPrice(Number(e.target.value))}
                                        className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-800 dark:text-white font-bold text-lg transition-all"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={saving} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none active:scale-95 disabled:opacity-70">
                                {saving ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" /> Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- SECURITY TAB --- */}
            {activeTab === 'security' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-300 max-w-2xl space-y-8">
                    <div className="mb-6">
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Security & Data</h3>
                        <p className="text-slate-500 dark:text-slate-400">Backup your data or perform destructive system resets safely.</p>
                    </div>

                    {/* Backup Card */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 shadow-md text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
                            <Database className="h-32 w-32" />
                        </div>
                        <div className="relative z-10">
                            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6">
                                <Download className="h-6 w-6 text-white" />
                            </div>
                            <h4 className="text-2xl font-bold mb-2">Download Backup</h4>
                            <p className="text-emerald-50 mb-6 max-w-sm">Export your entire system configuration as a JSON file to keep it safe.</p>
                            <button onClick={exportData} className="px-6 py-3 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold transition-colors active:scale-95 shadow-sm flex items-center gap-2 w-max">
                                <Download className="h-4 w-4 stroke-[2.5px]" /> Export Now
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-rose-50 dark:bg-rose-900/10 border-2 border-dashed border-rose-200 dark:border-rose-900/40 rounded-3xl p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="h-12 w-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-6 w-6 stroke-[2px]" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-rose-700 dark:text-rose-400 mb-1">Danger Zone</h4>
                                <p className="text-sm text-rose-600/80 dark:text-rose-400/80">Proceed with extreme caution. This will permanently wipe all logs and meal histories. Members will be kept.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">To confirm, type "RESET"</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input 
                                    type="text" 
                                    value={resetConfirm}
                                    onChange={(e) => setResetConfirm(e.target.value)}
                                    placeholder="RESET"
                                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-slate-800 dark:text-white font-mono uppercase tracking-widest"
                                />
                                <button 
                                    onClick={handleReset}
                                    disabled={resetConfirm !== 'RESET'}
                                    className="px-6 py-3 bg-rose-600 disabled:bg-slate-300 disabled:text-slate-500 hover:bg-rose-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Trash2 className="h-4 w-4" /> Reset Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- LOGS TAB --- */}
            {activeTab === 'logs' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-300 h-full flex flex-col">
                    <div className="mb-8 shrink-0">
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2 flex items-center gap-3">
                            <Activity className="h-8 w-8 text-blue-500" />
                            Activity Timeline
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">A detailed audit trail of all actions performed in the system.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                                <Clock className="h-12 w-12 mb-4 opacity-20" />
                                <p className="font-bold">No activity recorded yet.</p>
                            </div>
                        ) : (
                            <div className="relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700 py-4">
                                {logs.map((log) => (
                                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8 transition-all hover:-translate-y-1">
                                        
                                        {/* Timeline Dot & Icon */}
                                        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 border-white dark:border-slate-800 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${getLogColor(log.action)}`}>
                                            {getLogIcon(log.action)}
                                        </div>

                                        {/* Content Box */}
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm group-hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200">{log.action}</h4>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{log.details}</p>
                                            
                                            <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 min-w-0">
                                                <div className="h-6 w-6 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                    {log.performedBy.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 truncate">{log.performedBy}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- AUTO MEALS TAB --- */}
            {activeTab === 'auto_meals' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-300 h-full flex flex-col">
                    <div className="mb-8 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Auto Meals</h3>
                            <p className="text-slate-500 dark:text-slate-400">Configure default daily meal selections.</p>
                        </div>
                        <button onClick={saveAutoMeals} disabled={saving} className="px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 flex items-center justify-center gap-2 font-bold transition-all active:scale-95 disabled:opacity-70">
                            {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="h-4 w-4" />} 
                            Save Defaults
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {members.map(member => {
                                const defaultMeals = member.defaultMeals || { lunch: true, dinner: true };
                                return (
                                    <div key={member.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="h-12 w-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 overflow-hidden shrink-0 shadow-sm">
                                                {member.photoBase64 ? (
                                                    <img src={member.photoBase64} alt={member.fullName} className="h-full w-full object-cover" />
                                                ) : (
                                                    member.fullName.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{member.fullName}</h4>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${member.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>{member.status}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 shrink-0">
                                            {/* Lunch Toggle */}
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-xs font-bold text-slate-500 w-12 text-right">LUNCH</span>
                                                <button 
                                                    onClick={() => toggleAutoMeal(member.id, 'lunch')}
                                                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none ${defaultMeals.lunch ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${defaultMeals.lunch ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                </button>
                                            </div>
                                            {/* Dinner Toggle */}
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-xs font-bold text-slate-500 w-12 text-right">DINNER</span>
                                                <button 
                                                    onClick={() => toggleAutoMeal(member.id, 'dinner')}
                                                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none ${defaultMeals.dinner ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${defaultMeals.dinner ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

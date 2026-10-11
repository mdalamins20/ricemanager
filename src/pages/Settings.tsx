import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { Button } from '../components/Button';
import { 
  Save, Sliders, ShieldAlert, Activity, Clock, 
  CheckCircle2, AlertTriangle, Download, Trash2, 
  Settings as SettingsIcon, Database,
  UserPlus, Edit3, Trash
} from 'lucide-react';
import { AppSettings, LogEntry, Member, MonthRateConfig } from '../types';
import { logAction } from '../utils/logger';
import { format } from 'date-fns';
import { MonthPicker } from '../components/MonthPicker';
import { getMealRateForMonth, getMonthRateConfig, formatMealRate, calculateMealCost } from '../utils/pricing';
import { Package, Utensils, RotateCcw, Info, Sparkles, ChefHat, Globe, Radio, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import { testWhatsAppServerConnection, getWhatsAppApiUrl, DEFAULT_NGROK_URL } from '../utils/apiConfig';

type Tab = 'general' | 'security' | 'logs' | 'auto_meals';

export const Settings: React.FC = () => {
  const [rawSettings, setRawSettings] = useState<AppSettings | null>(null);
  const [price, setPrice] = useState<number>(65);
  const [messName, setMessName] = useState<string>('');
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [vendorPhone, setVendorPhone] = useState<string>('');
  const [whatsappServerUrl, setWhatsappServerUrl] = useState<string>('');
  const [testingServer, setTestingServer] = useState(false);
  const [serverTestResult, setServerTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const notifyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smart Pricing State
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isMonthSpecific, setIsMonthSpecific] = useState<boolean>(true);
  const [pricingMode, setPricingMode] = useState<'per_meal' | 'monthly_package'>('monthly_package');
  const [packageAmount, setPackageAmount] = useState<number>(4100);
  const [packageDays, setPackageDays] = useState<number>(30);
  const [packageMeals, setPackageMeals] = useState<number>(60);
  const [perMealRate, setPerMealRate] = useState<number>(65);

  useEffect(() => {
    return () => {
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    };
  }, []);

  const triggerNotification = (type: 'success' | 'error', message: string) => {
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setNotification({ type, message });
    notifyTimeoutRef.current = setTimeout(() => setNotification(null), 3000);
  };
  
  // Danger Zone specific
  const [resetConfirm, setResetConfirm] = useState('');

  const syncStateWithSettings = (data: AppSettings, monthStr: string) => {
    setRawSettings(data);
    setPrice(data.mealPrice || 65);
    setMessName(data.messName || 'RiceMgr');
    setYoutubeVideoUrl(data.youtubeVideoUrl || '');
    setVendorName(data.vendorName || '');
    setVendorPhone(data.vendorPhone || '');
    setWhatsappServerUrl(data.whatsappServerUrl || DEFAULT_NGROK_URL);

    const monthConfig = data.monthRates?.[monthStr];
    if (monthConfig) {
      setIsMonthSpecific(true);
      setPricingMode(monthConfig.pricingMode || 'per_meal');
      if (monthConfig.pricingMode === 'monthly_package') {
        setPackageAmount(monthConfig.packageAmount || 4100);
        setPackageDays(monthConfig.packageDays || 30);
        setPackageMeals(monthConfig.packageMeals || 60);
      } else {
        setPerMealRate(monthConfig.mealPrice || 65);
      }
    } else {
      // Default initial state when month not explicitly set
      setPricingMode('monthly_package');
      setPackageAmount(4100);
      setPackageDays(30);
      setPackageMeals(60);
      setPerMealRate(data.mealPrice || 65);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = db.collection('settings').doc('config');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data() as AppSettings;
          syncStateWithSettings(data, selectedMonth);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // When selectedMonth changes, load that month's config
  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (rawSettings) {
      syncStateWithSettings(rawSettings, newMonth);
    }
  };

  // Auto-update packageMeals when packageDays changes (if default 2 meals/day)
  const handleDaysChange = (days: number) => {
    setPackageDays(days);
    setPackageMeals(days * 2);
  };

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

  const calculatedPackageRate = packageMeals > 0 ? (packageAmount / packageMeals) : 0;
  const effectiveRate = pricingMode === 'monthly_package' ? calculatedPackageRate : Number(perMealRate);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      const updatedMonthRates = { ...(rawSettings?.monthRates || {}) };

      if (isMonthSpecific) {
        if (pricingMode === 'monthly_package') {
          updatedMonthRates[selectedMonth] = {
            pricingMode: 'monthly_package',
            mealPrice: calculatedPackageRate,
            packageAmount: Number(packageAmount),
            packageDays: Number(packageDays),
            packageMeals: Number(packageMeals)
          };
        } else {
          updatedMonthRates[selectedMonth] = {
            pricingMode: 'per_meal',
            mealPrice: Number(perMealRate)
          };
        }
      }

      const newSettingsData: AppSettings = {
        mealPrice: !isMonthSpecific ? effectiveRate : (rawSettings?.mealPrice || 65),
        monthRates: updatedMonthRates,
        messName: messName || 'RiceMgr',
        youtubeVideoUrl: youtubeVideoUrl || '',
        vendorName: vendorName.trim(),
        vendorPhone: vendorPhone.trim(),
        whatsappServerUrl: whatsappServerUrl.trim()
      };

      await db.collection('settings').doc('config').set(newSettingsData, { merge: true });
      setRawSettings(newSettingsData);
      
      const logDetails = isMonthSpecific 
        ? `Updated month ${selectedMonth} pricing (Mode: ${pricingMode}, Rate: ৳${formatMealRate(effectiveRate)}/meal)`
        : `Updated global default meal price (Price: ৳${formatMealRate(effectiveRate)}/meal)`;
        
      await logAction('Update Settings', logDetails);
      triggerNotification('success', 'Settings updated successfully!');
    } catch (error) {
      console.error(error);
      triggerNotification('error', 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsAppServer = async () => {
    setTestingServer(true);
    setServerTestResult(null);

    let rawUrl = (whatsappServerUrl.trim() || getWhatsAppApiUrl(rawSettings) || DEFAULT_NGROK_URL).trim();
    if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`;
    }
    // Auto-fix if someone truncated -free.dev
    if (rawUrl.includes('ngrok') && !rawUrl.includes('.dev') && !rawUrl.includes('.app') && !rawUrl.includes('.io')) {
      rawUrl = rawUrl.replace(/(\.ngrok)(\/|$)/, '$1-free.dev$2');
    }
    setWhatsappServerUrl(rawUrl);

    try {
      const result = await testWhatsAppServerConnection(rawUrl);
      if (result.success) {
        setServerTestResult({
          success: true,
          message: `✅ সফলভাবে সংযোগ স্থাপিত হয়েছে! (স্ট্যাটাস: ${result.status === 'connected' ? 'কানেক্টেড (+' + (result.phone || '') + ')' : result.status}, লেটেন্সি: ${result.latencyMs}ms)`
        });
      } else {
        setServerTestResult({
          success: false,
          message: `❌ সংযোগ ব্যর্থ: ${result.error || 'সার্ভার অফলাইন'}`
        });
      }
    } catch (e: any) {
      setServerTestResult({
        success: false,
        message: `❌ সংযোগ ব্যর্থ: ${e.message}`
      });
    } finally {
      setTestingServer(false);
    }
  };

  const handleResetMonth = async (monthKey: string) => {
    if (!rawSettings?.monthRates?.[monthKey]) return;
    setSaving(true);
    try {
      const updatedMonthRates = { ...(rawSettings.monthRates) };
      delete updatedMonthRates[monthKey];

      const newSettingsData: AppSettings = {
        ...rawSettings,
        monthRates: updatedMonthRates
      };

      await db.collection('settings').doc('config').set(newSettingsData, { merge: true });
      setRawSettings(newSettingsData);
      syncStateWithSettings(newSettingsData, selectedMonth);

      await logAction('Update Settings', `Reset custom rate for month ${monthKey} to global default`);
      triggerNotification('success', `Reset ${monthKey} rate to default!`);
    } catch (error) {
      console.error(error);
      triggerNotification('error', 'Failed to reset month rate.');
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

  const toggleAutoMeal = async (memberId: string, type: 'lunch' | 'dinner') => {
      const targetMember = members.find(m => m.id === memberId);
      if (!targetMember) return;
      const currentDefault = targetMember.defaultMeals || { lunch: true, dinner: true };
      const updatedDefault = { ...currentDefault, [type]: !currentDefault[type] };

      // Optimistic state update
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, defaultMeals: updatedDefault } : m));

      try {
          await db.collection('members').doc(memberId).update({ defaultMeals: updatedDefault });
          triggerNotification('success', `${targetMember.fullName}: Auto ${type === 'lunch' ? 'Lunch' : 'Dinner'} ${updatedDefault[type] ? 'enabled' : 'disabled'}`);
      } catch (err) {
          console.error("Auto meal toggle save error:", err);
          triggerNotification('error', 'Failed to update auto meal preference.');
          // Revert on error
          setMembers(prev => prev.map(m => m.id === memberId ? { ...m, defaultMeals: currentDefault } : m));
      }
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
          triggerNotification('success', 'Auto meal settings saved successfully!');
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
         <div className="mb-3 md:mb-8 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
             <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
                 <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
                     <SettingsIcon className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2px]" />
                 </div>
                 <div>
                     <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
                     <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">System Preferences</p>
                 </div>
             </div>
         </div>

         {/* Navigation Pills - Mobile Segmented Row / Desktop Vertical Sidebar */}
         <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                <button 
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as Tab); setNotification(null); }}
                  className={`flex items-center gap-2.5 md:gap-4 px-3.5 py-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-200 text-left shrink-0 md:shrink border active:scale-95 ${
                      isActive 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 md:bg-white md:dark:bg-slate-800 md:text-slate-800 md:dark:text-white md:border-emerald-100 md:dark:border-slate-600 md:translate-x-1' 
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                    <div className={`h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
                        isActive
                        ? 'bg-white/20 text-white md:bg-emerald-50 md:dark:bg-emerald-900/30 md:text-emerald-600 md:dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                        <tab.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                    </div>
                    <div>
                        <h4 className={`font-bold text-xs md:text-sm tracking-wide ${isActive ? 'text-white md:text-slate-800 md:dark:text-white' : ''}`}>{tab.label}</h4>
                        <p className={`hidden md:block text-[11px] font-medium mt-0.5 ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>{tab.desc}</p>
                    </div>
                </button>
            )})}
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden relative">
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 md:p-10 relative pb-28 md:pb-10">
            
            {/* --- GENERAL TAB --- */}
            {activeTab === 'general' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-300 max-w-3xl space-y-8">
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">General Preferences & Meal Pricing</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">Manage mess meal rates, monthly budget packages (e.g. ৳4,100), and month-specific calculations.</p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Month Selector Bar */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                        Target Month
                                    </label>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        Select Month for Rate Configuration
                                    </span>
                                </div>
                                <MonthPicker 
                                    value={selectedMonth} 
                                    onChange={handleMonthChange}
                                    className="w-full sm:w-auto"
                                />
                            </div>

                            {/* Month Status Badge */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-xs">
                                <div className="flex items-center gap-2">
                                    {rawSettings?.monthRates?.[selectedMonth] ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                                            {selectedMonth}: Custom Rate Active (৳{formatMealRate(rawSettings.monthRates[selectedMonth].mealPrice)}/meal)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs">
                                            <Info className="h-3.5 w-3.5 text-slate-400" />
                                            {selectedMonth}: Using Default Rate (৳{rawSettings?.mealPrice || 65}/meal)
                                        </span>
                                    )}
                                </div>

                                {rawSettings?.monthRates?.[selectedMonth] && (
                                    <button
                                        type="button"
                                        onClick={() => handleResetMonth(selectedMonth)}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline active:scale-95 transition-all"
                                        title="Reset this month's custom rate to default"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Pricing Mode Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                                Pricing Mode
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {/* Monthly Package Mode */}
                                <div 
                                    onClick={() => setPricingMode('monthly_package')}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        pricingMode === 'monthly_package' 
                                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${pricingMode === 'monthly_package' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Monthly Package Mode</h4>
                                                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Recommended</span>
                                            </div>
                                        </div>
                                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${pricingMode === 'monthly_package' ? 'border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {pricingMode === 'monthly_package' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        e.g., ৳4,100 budget for 30 days (60 meals). Scales proportionally based on meals consumed.
                                    </p>
                                </div>

                                {/* Per-Meal Fixed Mode */}
                                <div 
                                    onClick={() => setPricingMode('per_meal')}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        pricingMode === 'per_meal' 
                                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${pricingMode === 'per_meal' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                                <Utensils className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Fixed Meal Rate Mode</h4>
                                                <span className="text-[10px] font-medium text-slate-400">Fixed Rate</span>
                                            </div>
                                        </div>
                                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${pricingMode === 'per_meal' ? 'border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {pricingMode === 'per_meal' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Fixed price per individual meal (e.g., default ৳65/meal).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Mode Inputs */}
                        {pricingMode === 'monthly_package' ? (
                            <div className="space-y-4 bg-slate-50/70 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                    {/* Monthly Budget */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                                            Monthly Package Budget (৳)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm pointer-events-none">৳</span>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                value={packageAmount}
                                                onChange={(e) => setPackageAmount(Number(e.target.value))}
                                                className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 dark:text-white"
                                                placeholder="4100"
                                            />
                                        </div>
                                    </div>

                                    {/* Days in Month */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                                            Month Days
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            required
                                            value={packageDays}
                                            onChange={(e) => handleDaysChange(Number(e.target.value))}
                                            className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 dark:text-white"
                                            placeholder="30"
                                        />
                                    </div>

                                    {/* Standard Meals */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                                            Standard Meals
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={packageMeals}
                                            onChange={(e) => setPackageMeals(Number(e.target.value))}
                                            className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 dark:text-white"
                                            placeholder="60"
                                        />
                                    </div>
                                </div>

                                {/* Effective Calculated Rate Highlight */}
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                        Effective Rate Per Meal (৳{packageAmount} ÷ {packageMeals} meals):
                                    </span>
                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                        ৳{formatMealRate(calculatedPackageRate)} / meal
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50/70 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                                    Rate Per Meal (৳)
                                </label>
                                <div className="relative max-w-sm">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm pointer-events-none">৳</span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        required
                                        value={perMealRate}
                                        onChange={(e) => setPerMealRate(Number(e.target.value))}
                                        className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-base text-slate-800 dark:text-white"
                                        placeholder="65"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Scope Checkbox */}
                        <div className="flex items-center gap-2.5 px-1">
                            <input 
                                type="checkbox" 
                                id="monthScopeCheck"
                                checked={isMonthSpecific}
                                onChange={(e) => setIsMonthSpecific(e.target.checked)}
                                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                            <label htmlFor="monthScopeCheck" className="text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer">
                                Apply this rate starting from <strong>{selectedMonth}</strong> (Historical months remain preserved)
                            </label>
                        </div>

                        {/* Configured Months List */}
                        {rawSettings?.monthRates && Object.keys(rawSettings.monthRates).length > 0 && (
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                    Configured Month Rates
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(rawSettings.monthRates).map(([monthKey, config]) => (
                                        <div 
                                            key={monthKey} 
                                            onClick={() => handleMonthChange(monthKey)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                                selectedMonth === monthKey 
                                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                                            }`}
                                        >
                                            <span>{monthKey}: ৳{formatMealRate(config.mealPrice)}/meal</span>
                                            {config.pricingMode === 'monthly_package' && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedMonth === monthKey ? 'bg-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    ৳{config.packageAmount}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Food Vendor / Cook Information */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <ChefHat className="h-4 w-4 text-emerald-500" />
                                    Food Provider / Vendor Contact (বাবুর্চি / ভেন্ডর তথ্য)
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    ভেন্ডরকে পেমেন্ট দেওয়ার সাথে সাথে এই নম্বরে স্বয়ংক্রিয় হোয়াটসঅ্যাপ রসিদ ও মাস শেষে পূর্ণাঙ্গ মিল হিসাব যাবে।
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        ভেন্ডর / বাবুর্চির নাম
                                    </label>
                                    <input 
                                        type="text"
                                        value={vendorName}
                                        onChange={(e) => setVendorName(e.target.value)}
                                        placeholder="যেমন: খালা / বাবুর্চি / বুয়া"
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        হোয়াটসঅ্যাপ মোবাইল নম্বর
                                    </label>
                                    <input 
                                        type="text"
                                        value={vendorPhone}
                                        onChange={(e) => setVendorPhone(e.target.value)}
                                        placeholder="যেমন: 017xxxxxxxx বা 88017xxxxxxxx"
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* WhatsApp Server & Ngrok Permanent Tunnel Connection */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-emerald-500" />
                                        WhatsApp Server URL (পার্মানেন্ট Ngrok / অনলাইন ক্লাউড সংযোগ)
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        অ্যাপটি Netlify বা মোবাইল থেকে চলার সময় আপনার ল্যাপটপের WhatsApp ইঞ্জিনের সাথে যুক্ত থাকতে এই পার্মানেন্ট লিংক ব্যবহৃত হবে।
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleTestWhatsAppServer}
                                        disabled={testingServer}
                                        className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                    >
                                        {testingServer ? (
                                            <>
                                                <div className="h-3.5 w-3.5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                                টেস্টিং...
                                            </>
                                        ) : (
                                            <>
                                                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                                                কানেকশন টেস্ট করুন
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    সার্ভার বেস ইউআরএল (API Base URL)
                                </label>
                                <div className="relative">
                                    <input 
                                        type="url"
                                        value={whatsappServerUrl}
                                        onChange={(e) => {
                                            setWhatsappServerUrl(e.target.value);
                                            setServerTestResult(null);
                                        }}
                                        placeholder="https://unappreciably-nonsyllogistical-gonzalo.ngrok-free.dev"
                                        className="w-full pl-3.5 pr-28 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-xs sm:text-sm text-slate-800 dark:text-white"
                                    />
                                    {whatsappServerUrl !== DEFAULT_NGROK_URL ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setWhatsappServerUrl(DEFAULT_NGROK_URL);
                                                setServerTestResult(null);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-md transition-all active:scale-95"
                                        >
                                            স্থায়ী লিংক বসান
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setWhatsappServerUrl('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-rose-500 bg-slate-100 dark:bg-slate-700 rounded-md"
                                        >
                                            মুছুন
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Test Result Message */}
                            {serverTestResult && (
                                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                                    serverTestResult.success 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' 
                                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                }`}>
                                    {serverTestResult.success ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
                                    <span>{serverTestResult.message}</span>
                                </div>
                            )}

                            {/* Helpful Guide Note */}
                            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                                <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                                    পার্মানেন্ট স্ট্যাটিক ডোমেইন সুবিধা
                                </div>
                                <p className="text-slate-600 dark:text-slate-400">
                                    আপনার স্থায়ী ডোমেইন: <code className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded font-mono text-[10px] text-emerald-600 dark:text-emerald-400">https://unappreciably-nonsyllogistical-gonzalo.ngrok-free.dev</code><br />
                                    এটি সিস্টেমে পার্মানেন্টভাবে যুক্ত হয়ে গেছে। আপনি ল্যাপটপ বন্ধ বা রিস্টার্ট করলেও উইন্ডোজ স্টার্টআপে এটি স্বয়ংক্রিয়ভাবে ব্যাকগ্রাউন্ডে চালু হবে এবং লিংক কখনোই পরিবর্তন হবে না।
                                </p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" disabled={saving} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none active:scale-95 disabled:opacity-70">
                                {saving ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" /> Save Preferences & Rates
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

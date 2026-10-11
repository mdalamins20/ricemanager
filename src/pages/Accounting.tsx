import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';
import { format } from 'date-fns';
import { ChefHat, Plus, Trash2, Calendar, Banknote, WalletCards, X, Send, Phone, Edit3, CheckCircle, AlertCircle, Utensils } from 'lucide-react';
import { useDeposits, useVendorPayments, useMeals, useSettings } from '../contexts';
import { MonthPicker } from '../components/MonthPicker';
import { logAction } from '../utils/logger';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { getMealRateForMonth, formatMealRate } from '../utils/pricing';
import { formatWhatsAppPhone } from '../utils/phone';
import { getWhatsAppApiUrl, getApiHeaders } from '../utils/apiConfig';

export const Accounting: React.FC = () => {
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { vendorPayments, loading: vendorPaymentsLoading } = useVendorPayments();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { settings, loading: settingsLoading } = useSettings();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);

  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ show: true, type, message });
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; payAmount: number }>({
    isOpen: false,
    id: '',
    payAmount: 0
  });

  const [sendStatementConfirm, setSendStatementConfirm] = useState(false);
  const [statementSending, setStatementSending] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentForMonth, setPaymentForMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Vendor Info State (from settings)
  const [vendorNameInput, setVendorNameInput] = useState(settings?.vendorName || '');
  const [vendorPhoneInput, setVendorPhoneInput] = useState(settings?.vendorPhone || '');
  const [savingVendor, setSavingVendor] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setVendorNameInput(settings.vendorName || '');
      setVendorPhoneInput(settings.vendorPhone || '');
    }
  }, [settings]);

  React.useEffect(() => {
    const authUnsub = firebase.auth().onAuthStateChanged((currentUser) => setUser(currentUser));
    return () => authUnsub();
  }, []);

  const loading = depositsLoading || vendorPaymentsLoading || mealsLoading || settingsLoading;

  // Analytics for Member Deposits & Vendor Payments
  const { totalCollections, totalPaid, cashInHand } = useMemo(() => {
    const monthDeposits = allDeposits.filter(d => d.date.startsWith(selectedMonth));
    const totalCollections = monthDeposits.reduce((acc, curr) => acc + curr.amount, 0);

    const monthPayments = vendorPayments.filter(vp => {
        const vpMonth = vp.forMonth || vp.date.substring(0, 7);
        return vpMonth === selectedMonth;
    });
    const totalPaid = monthPayments.reduce((acc, curr) => acc + curr.amount, 0);
    const cashInHand = totalCollections - totalPaid;
    return { totalCollections, totalPaid, cashInHand };
  }, [allDeposits, vendorPayments, selectedMonth]);

  // Vendor Meal & Bill Analytics for Selected Month
  const vendorBilling = useMemo(() => {
    let totalMeals = 0;
    allMeals.forEach(mDoc => {
      if (mDoc.date.startsWith(selectedMonth) && mDoc.entries) {
        Object.values(mDoc.entries).forEach(entry => {
          if (entry.lunch) totalMeals++;
          if (entry.dinner) totalMeals++;
          totalMeals += Number(entry.guestLunch) || 0;
          totalMeals += Number(entry.guestDinner) || 0;
        });
      }
    });

    const mealRate = getMealRateForMonth(settings, selectedMonth);
    const totalFoodCost = Math.round(totalMeals * mealRate);
    const remainingDue = totalFoodCost - totalPaid;

    const [y, m] = selectedMonth.split('-');
    const monthName = format(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1), 'MMMM yyyy');

    return {
      totalMeals,
      mealRate,
      totalFoodCost,
      remainingDue,
      monthName
    };
  }, [allMeals, selectedMonth, settings, totalPaid]);

  const sortedPayments = useMemo(() => {
    const filtered = vendorPayments.filter(vp => {
        const vpMonth = vp.forMonth || vp.date.substring(0, 7);
        return vpMonth === selectedMonth;
    });
    const getTimestamp = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'string') return new Date(val).getTime() || 0;
      if (typeof val?.seconds === 'number') return val.seconds * 1000;
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      return 0;
    };
    return filtered.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
    });
  }, [vendorPayments, selectedMonth]);

  // Save Vendor Contact Info
  const handleSaveVendorInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingVendor(true);
    try {
      await db.collection('settings').doc('config').set({
        vendorName: vendorNameInput.trim(),
        vendorPhone: vendorPhoneInput.trim()
      }, { merge: true });

      setIsVendorModalOpen(false);
      showToast('success', 'ভেন্ডর তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
      logAction('Update Vendor Info', `Updated vendor: ${vendorNameInput} (${vendorPhoneInput})`).catch(console.error);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'ভেন্ডর তথ্য সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setSavingVendor(false);
    }
  };

  // Add Vendor Payment with Instant WhatsApp Receipt
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        showToast('error', 'পেমেন্ট যুক্ত করতে অনুগ্রহ করে লগইন করুন।');
        return;
    }
    const payNum = Number(amount);
    if (!payNum || isNaN(payNum) || payNum <= 0) return;
    
    setSubmitting(true);
    try {
      await db.collection('vendor_payments').add({
        amount: payNum,
        date: transactionDate,
        forMonth: paymentForMonth,
        note,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const [y, m] = paymentForMonth.split('-');
      const formattedMonthName = format(new Date(parseInt(y), parseInt(m) - 1, 1), 'MMMM yyyy');
      logAction('Add Vendor Payment', `Paid ৳${payNum} to vendor on ${transactionDate} for ${formattedMonthName}`).catch(console.error);

      // Close modal and reset fields immediately
      setIsAddModalOpen(false);
      setAmount('');
      setNote('');
      setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentForMonth(selectedMonth);

      showToast('success', `✅ ভেন্ডর পেমেন্ট ৳${payNum} সফলভাবে সংরক্ষিত হয়েছে!`);

      // WhatsApp automated payment receipt
      const vPhone = formatWhatsAppPhone(settings?.vendorPhone);
      if (vPhone) {
        const newTotalPaid = totalPaid + payNum;
        const newRemainingDue = vendorBilling.totalFoodCost - newTotalPaid;
        const apiBase = getWhatsAppApiUrl(settings);

        fetch(`${apiBase}/api/vendor-payment-receipt`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            vendorName: settings?.vendorName || 'খালা / বাবুর্চি',
            phone: vPhone,
            paymentDate: transactionDate,
            amount: payNum,
            paymentForMonth: formattedMonthName,
            totalPaidThisMonth: newTotalPaid,
            remainingDueThisMonth: newRemainingDue,
            note: note || ''
          })
        }).then(r => r.json()).then(res => {
          if (res?.success) {
            showToast('info', `📲 ভেন্ডরের হোয়াটসঅ্যাপে (${vPhone}) পেমেন্ট রসিদ পাঠানো হয়েছে!`);
          }
        }).catch(err => {
          console.log('[Vendor Bot] Offline or error:', err);
        });
      }
    } catch (error) {
      console.error("Error adding vendor payment: ", error);
      showToast('error', 'পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // Send Month-End Vendor Statement via WhatsApp
  const handleSendVendorStatement = async () => {
    setSendStatementConfirm(false);
    const vPhone = formatWhatsAppPhone(settings?.vendorPhone);
    if (!vPhone) {
      showToast('warning', 'ভেন্ডরের কোনো হোয়াটসঅ্যাপ নম্বর পাওয়া যায়নি! অনুগ্রহ করে নম্বর যুক্ত করুন।');
      setIsVendorModalOpen(true);
      return;
    }

    setStatementSending(true);
    const apiBase = getWhatsAppApiUrl(settings);
    try {
      const res = await fetch(`${apiBase}/api/vendor-monthly-statement`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          vendorName: settings?.vendorName || 'খালা / বাবুর্চি',
          phone: vPhone,
          monthName: vendorBilling.monthName,
          totalMeals: vendorBilling.totalMeals,
          mealRate: formatMealRate(vendorBilling.mealRate),
          totalCost: vendorBilling.totalFoodCost,
          totalPaid: totalPaid,
          dueAmount: vendorBilling.remainingDue
        })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('success', `✅ ভেন্ডরের হোয়াটসঅ্যাপে (${vPhone}) ${vendorBilling.monthName} মাসের চূড়ান্ত হিসাব সফলভাবে পাঠানো হয়েছে!`);
      } else {
        showToast('error', `পাঠানো যায়নি: ${data?.error || 'সার্ভার সমস্যা'}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'হোয়াটসঅ্যাপ সার্ভারের সাথে সংযোগ করা যায়নি। সার্ভার চালু আছে কিনা দেখুন।');
    } finally {
      setStatementSending(false);
    }
  };

  const handleDelete = (id: string, payAmount: number) => {
    setDeleteConfirm({
      isOpen: true,
      id,
      payAmount
    });
  };

  const confirmDeletePayment = async () => {
    const { id, payAmount } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, id: '', payAmount: 0 });
    try {
      await db.collection('vendor_payments').doc(id).delete();
      logAction('Delete Vendor Payment', `Deleted vendor payment of ৳${payAmount}`).catch(console.error);
      showToast('success', 'পেমেন্ট রেকর্ড মুছে ফেলা হয়েছে।');
    } catch (error) {
      console.error("Error deleting payment: ", error);
      showToast('error', 'পেমেন্ট রেকর্ড মুছতে সমস্যা হয়েছে।');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2.5">
             Vendor Accounting
          </h2>
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Food Provider Ledger</p>
        </div>
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            {user && (
                <button 
                    onClick={() => {
                        setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
                        setPaymentForMonth(selectedMonth);
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm text-xs sm:text-sm font-bold transition-all active:scale-95 shrink-0"
                >
                    <Plus className="h-4 w-4 stroke-[2.5px]" /> 
                    <span>Add Payment</span>
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-4 sm:space-y-6 md:space-y-8">
      
      {/* Top Stats Grid - Mobile 2-column & Desktop 3-column with balanced spacing */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
          <div className="col-span-1 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col justify-between h-full gap-2 sm:gap-4">
                  <div className="flex justify-between items-start">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-0.5 tracking-tight truncate">৳{totalCollections.toLocaleString()}</h3>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Member Deposits</p>
                  </div>
              </div>
          </div>

          <div className="col-span-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 sm:h-24 sm:w-24 bg-white/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col justify-between h-full gap-2 sm:gap-4">
                  <div className="flex justify-between items-start">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <ChefHat className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-black mb-0.5 tracking-tight truncate">৳{totalPaid.toLocaleString()}</h3>
                      <p className="text-[10px] sm:text-xs font-bold text-orange-100 uppercase tracking-wider">Paid to Vendor</p>
                  </div>
              </div>
          </div>
          
          <div className={`col-span-2 sm:col-span-1 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg text-white relative overflow-hidden group ${cashInHand >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20'}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 sm:h-24 sm:w-24 bg-white/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>
              {/* Mobile: Horizontal executive row, Desktop: Vertical card */}
              <div className="relative z-10 flex flex-row sm:flex-col justify-between items-center sm:items-stretch h-full gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:block">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                          <WalletCards className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div className="sm:hidden">
                          <p className="text-xs font-bold text-white/90 uppercase tracking-wider">Cash in Hand</p>
                          <span className="text-[10px] font-medium text-white/70">{cashInHand >= 0 ? 'Net Available' : 'Deficit'}</span>
                      </div>
                  </div>
                  <div className="text-right sm:text-left">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-black mb-0.5 tracking-tight">
                          {cashInHand >= 0 ? '+' : ''}৳{cashInHand.toLocaleString()}
                      </h3>
                      <p className="hidden sm:block text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">Cash in Hand</p>
                  </div>
              </div>
          </div>
      </div>

      {/* Vendor Overview & Automated WhatsApp Hub */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-36 w-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-700/60">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <ChefHat className="h-6 w-6 stroke-[2.2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {settings?.vendorName || 'খালা / বাবুর্চি'}
                </h3>
                {user && (
                  <button 
                    type="button"
                    onClick={() => setIsVendorModalOpen(true)}
                    className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                    title="ভেন্ডর তথ্য এডিট করুন"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                <Phone className="h-3 w-3 text-emerald-400" />
                {settings?.vendorPhone ? `হোয়াটসঅ্যাপ: +${formatWhatsAppPhone(settings.vendorPhone)}` : <span className="text-amber-400">হোয়াটসঅ্যাপ নম্বর যোগ করা নেই</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => setIsVendorModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                <span>{settings?.vendorPhone ? 'নম্বর পরিবর্তন' : 'নম্বর যুক্ত করুন'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={statementSending}
              onClick={() => setSendStatementConfirm(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{statementSending ? 'পাঠানো হচ্ছে...' : 'ভেন্ডরকে মাসিক হিসাব পাঠান'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Month Breakdown for Vendor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">মোট মিল ({vendorBilling.monthName})</span>
            <span className="text-base sm:text-lg font-black text-white">{vendorBilling.totalMeals} টি</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">রেট: ৳{formatMealRate(vendorBilling.mealRate)}</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">মোট মিল বিল</span>
            <span className="text-base sm:text-lg font-black text-emerald-400">৳{vendorBilling.totalFoodCost.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">খাদ্য বাবদ প্রদেয়</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">পরিশোধ করা হয়েছে</span>
            <span className="text-base sm:text-lg font-black text-amber-400">৳{totalPaid.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{sortedPayments.length} টি কিস্তিতে</span>
          </div>

          <div className={`border rounded-2xl p-3 ${vendorBilling.remainingDue > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
            <span className="text-[10px] uppercase font-bold tracking-wider block mb-1">
              {vendorBilling.remainingDue > 0 ? 'অবশিষ্ট বকেয়া' : 'অগ্রিম / পরিশোধিত'}
            </span>
            <span className="text-base sm:text-lg font-black">
              {vendorBilling.remainingDue > 0 ? `৳${vendorBilling.remainingDue.toLocaleString()}` : `৳${Math.abs(vendorBilling.remainingDue).toLocaleString()} (পরিশোধিত)`}
            </span>
            <span className="text-[10px] opacity-80 block mt-0.5">চলতি স্থিতি</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
             <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                 <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-white">Vendor Payment History</h3>
          </div>
          
          {sortedPayments.length === 0 ? (
             <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <ChefHat className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="font-bold text-lg text-slate-800 dark:text-slate-300">No payments yet</p>
                <p className="text-sm mt-1">Record a payment to the food provider to see it here.</p>
             </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="col-span-3">Date</div>
                    <div className="col-span-3">Amount</div>
                    <div className="col-span-5">Note</div>
                    <div className="col-span-1 text-right">Action</div>
                </div>

                {sortedPayments.map((payment) => (
                    <div key={payment.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col md:grid md:grid-cols-12 md:gap-4 md:items-center">
                        
                        <div className="flex justify-between items-start md:contents mb-2 md:mb-0">
                            <div className="md:col-span-3 flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-wider">{format(new Date(payment.date), 'MMM')}</span>
                                    <span className="text-sm font-black leading-none">{format(new Date(payment.date), 'dd')}</span>
                                </div>
                                <div className="md:hidden flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-slate-800 dark:text-white text-base tracking-tight">৳{payment.amount.toLocaleString()}</p>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                            {format(new Date(`${payment.forMonth || payment.date.substring(0, 7)}-01`), 'MMM yyyy')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{payment.note || 'No note provided'}</p>
                                </div>
                            </div>
                            
                            {user && (
                                <button 
                                    onClick={() => handleDelete(payment.id, payment.amount)}
                                    className="md:hidden p-2 text-slate-400 hover:text-red-500 active:scale-90 transition-transform"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="hidden md:block md:col-span-3 font-bold text-slate-800 dark:text-slate-200">
                            ৳{payment.amount.toLocaleString()}
                        </div>
                        <div className="hidden md:block md:col-span-5 text-sm truncate flex flex-col justify-center">
                            <span className="text-slate-500 dark:text-slate-400">{payment.note || <span className="text-slate-300 dark:text-slate-600 italic">No note provided</span>}</span>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Bill for {format(new Date(`${payment.forMonth || payment.date.substring(0, 7)}-01`), 'MMMM yyyy')}</span>
                        </div>
                        <div className="hidden md:flex md:col-span-1 justify-end">
                            {user && (
                                <button 
                                    onClick={() => handleDelete(payment.id, payment.amount)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>

      </div>

      {/* Add Payment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-3xl w-full max-w-md shadow-2xl border-t sm:border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto pb-safe">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-4 sm:hidden"></div>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 <ChefHat className="h-5 w-5 text-emerald-600" /> Record Vendor Payment
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddPayment} className="p-6 space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Payment Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="date" 
                        max={format(new Date(), 'yyyy-MM-dd')}
                        value={transactionDate}
                        onChange={(e) => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          setTransactionDate(e.target.value > today ? today : e.target.value);
                        }}
                        required
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all dark:text-white font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">For Month</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="month" 
                        max={format(new Date(), 'yyyy-MM')}
                        value={paymentForMonth}
                        onChange={(e) => {
                          const curMonth = format(new Date(), 'yyyy-MM');
                          setPaymentForMonth(e.target.value > curMonth ? curMonth : e.target.value);
                        }}
                        required
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all dark:text-white font-medium text-sm"
                      />
                    </div>
                  </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Amount (৳)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold">৳</span>
                  </div>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    required
                    min="1"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all dark:text-white font-medium text-lg"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Note (Optional)</label>
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Payment for 1st week of August"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all dark:text-white font-medium"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 dark:shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {submitting ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Record Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vendor Contact Modal */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsVendorModalOpen(false)} />
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-emerald-600" /> ভেন্ডর / বাবুর্চি তথ্য
              </h3>
              <button 
                type="button" 
                onClick={() => setIsVendorModalOpen(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorInfo} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">ভেন্ডর / বাবুর্চির নাম</label>
                <input 
                  type="text" 
                  value={vendorNameInput} 
                  onChange={e => setVendorNameInput(e.target.value)} 
                  placeholder="যেমন: খালা / বাবুর্চি / বুয়া" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">হোয়াটসঅ্যাপ মোবাইল নম্বর</label>
                <input 
                  type="text" 
                  required
                  value={vendorPhoneInput} 
                  onChange={e => setVendorPhoneInput(e.target.value)} 
                  placeholder="যেমন: 017xxxxxxxx বা 88017xxxxxxxx" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">পেমেন্ট করার সাথে সাথে এই নম্বরে স্বয়ংক্রিয় রসিদ যাবে।</p>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingVendor}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingVendor ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Month-End Statement Confirmation Dialog */}
      <ConfirmModal
        isOpen={sendStatementConfirm}
        title="ভেন্ডরকে মাসিক হিসাব পাঠাবেন?"
        message={`${settings?.vendorName || 'ভেন্ডর'}-কে ${vendorBilling.monthName} মাসের মোট মিল (${vendorBilling.totalMeals} টি), মোট খাদ্য বিল (৳${vendorBilling.totalFoodCost.toLocaleString()}), মোট পরিশোধ (৳${totalPaid.toLocaleString()}) এবং বর্তমান স্থিতির পূর্ণাঙ্গ হোয়াটসঅ্যাপ বার্তা পাঠাতে চান?`}
        confirmText="হ্যাঁ, পাঠান"
        cancelText="বাতিল"
        variant="emerald"
        onConfirm={handleSendVendorStatement}
        onCancel={() => setSendStatementConfirm(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="পেমেন্ট রেকর্ড মুছে ফেলবেন?"
        message={`ভেন্ডরকে প্রদত্ত ৳${deleteConfirm.payAmount} টাকার এই পেমেন্ট রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?`}
        confirmText="মুছে ফেলুন"
        cancelText="বাতিল"
        variant="rose"
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
      />

      {/* In-app Toast Notification */}
      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

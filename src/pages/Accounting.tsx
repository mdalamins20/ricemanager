import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';
import { format } from 'date-fns';
import { ChefHat, Plus, Trash2, Calendar, Banknote, WalletCards, X } from 'lucide-react';
import { useDeposits, useVendorPayments } from '../contexts';

export const Accounting: React.FC = () => {
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { vendorPayments, loading: vendorPaymentsLoading } = useVendorPayments();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentForMonth, setPaymentForMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  React.useEffect(() => {
    const authUnsub = firebase.auth().onAuthStateChanged((currentUser) => setUser(currentUser));
    return () => authUnsub();
  }, []);

  const loading = depositsLoading || vendorPaymentsLoading;

  // Analytics
  const { totalCollections, totalPaid, cashInHand } = useMemo(() => {
    // Filter deposits by selected month
    const monthDeposits = allDeposits.filter(d => d.date.startsWith(selectedMonth));
    const totalCollections = monthDeposits.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Filter vendor payments by selected month (using forMonth if available, otherwise fallback to date prefix)
    const monthPayments = vendorPayments.filter(vp => {
        const vpMonth = vp.forMonth || vp.date.substring(0, 7);
        return vpMonth === selectedMonth;
    });
    const totalPaid = monthPayments.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Cash in hand for the selected month
    const cashInHand = totalCollections - totalPaid;
    return { totalCollections, totalPaid, cashInHand };
  }, [allDeposits, vendorPayments, selectedMonth]);

  const sortedPayments = useMemo(() => {
    const filtered = vendorPayments.filter(vp => {
        const vpMonth = vp.forMonth || vp.date.substring(0, 7);
        return vpMonth === selectedMonth;
    });
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));
  }, [vendorPayments, selectedMonth]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        setErrorToast("You must be logged in to add a payment.");
        return;
    }
    if (!amount || isNaN(Number(amount))) return;
    
    setSubmitting(true);
    try {
      await db.collection('vendor_payments').add({
        amount: Number(amount),
        date: transactionDate,
        forMonth: paymentForMonth,
        note,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Also log activity
      await db.collection('activity_logs').add({
        action: 'VENDOR_PAYMENT_ADDED',
        details: `Paid ৳${amount} to vendor on ${transactionDate} for ${format(new Date(`${paymentForMonth}-01`), 'MMMM yyyy')}`,
        performedBy: firebase.auth().currentUser?.email || 'System',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      setIsAddModalOpen(false);
      setAmount('');
      setNote('');
      setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentForMonth(selectedMonth);
    } catch (error) {
      console.error("Error adding vendor payment: ", error);
      setErrorToast("Failed to add payment. You may not have permission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, payAmount: number) => {
    if (window.confirm("Are you sure you want to delete this payment record?")) {
      try {
        await db.collection('vendor_payments').doc(id).delete();
        
        await db.collection('activity_logs').add({
          action: 'VENDOR_PAYMENT_DELETED',
          details: `Deleted vendor payment of ৳${payAmount}`,
          performedBy: firebase.auth().currentUser?.email || 'System',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Error deleting payment: ", error);
        setErrorToast("Failed to delete payment. You may not have permission.");
      }
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
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 py-4 md:py-6 -mt-4 md:-mt-8 mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
             Vendor Accounting
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 uppercase tracking-wider font-bold">Manage payments to food provider</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hidden md:flex">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white" />
            </div>
            {user && (
                <button 
                    onClick={() => {
                        setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
                        setPaymentForMonth(selectedMonth);
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-200 dark:shadow-emerald-900/20 transition-all active:scale-95 font-bold"
                >
                    <Plus className="h-5 w-5" /> 
                    <span className="hidden sm:inline">Add Payment</span>
                    <span className="sm:hidden">Add</span>
                </button>
            )}
        </div>
      </div>
      
      {/* Mobile Month Picker */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
          <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Month</span>
          </div>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-6 md:space-y-8">
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                          <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">৳{totalCollections.toLocaleString()}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Member Deposits</p>
                  </div>
              </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <ChefHat className="h-5 w-5 text-white" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-3xl font-black mb-1">৳{totalPaid.toLocaleString()}</h3>
                      <p className="text-xs font-bold text-orange-100 uppercase tracking-wider">Total Paid to Vendor</p>
                  </div>
              </div>
          </div>
          
          <div className={`rounded-3xl p-6 shadow-lg text-white relative overflow-hidden group ${cashInHand >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20'}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <WalletCards className="h-5 w-5 text-white" />
                      </div>
                  </div>
                  <div>
                      <h3 className="text-3xl font-black mb-1">
                          {cashInHand >= 0 ? '+' : ''}৳{cashInHand.toLocaleString()}
                      </h3>
                      <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Cash in Hand</p>
                  </div>
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
                                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(payment.date), 'MMM')}</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-300 leading-none">{format(new Date(payment.date), 'dd')}</span>
                                </div>
                                <div className="md:hidden">
                                    <p className="font-bold text-slate-800 dark:text-slate-200">৳{payment.amount.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase">For: {format(new Date(`${payment.forMonth || payment.date.substring(0, 7)}-01`), 'MMM yyyy')}</p>
                                    <p className="text-xs text-slate-500">{payment.note || 'No note'}</p>
                                </div>
                            </div>
                            
                            {user && (
                                <button 
                                    onClick={() => handleDelete(payment.id, payment.amount)}
                                    className="md:hidden p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 <ChefHat className="h-5 w-5 text-emerald-600" /> Record Vendor Payment
              </h3>
              <button 
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
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
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
                        value={paymentForMonth}
                        onChange={(e) => setPaymentForMonth(e.target.value)}
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

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed bottom-4 right-4 z-[110] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-red-600/20 flex items-center gap-3 animate-in slide-in-from-bottom-5">
            <span className="font-bold">{errorToast}</span>
            <button onClick={() => setErrorToast(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X className="h-4 w-4" />
            </button>
        </div>
      )}
    </div>
  );
};

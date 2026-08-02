
import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { Button } from '../components/Button';
import { UserPlus, UserCog, Trash2, Phone, MapPin, X, UsersRound, Lock, Calendar, ChevronRight, UtensilsCrossed, AlertTriangle, CheckCircle2, SunMedium, MoonStar } from 'lucide-react';
import { Member, DailyMealDoc, AppSettings, Deposit } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { logAction } from '../utils/logger';
import { useData } from '../DataContext';

// --- Sub-component: Member Details Modal ---
const MemberHistory: React.FC<{ member: Member; onClose: () => void }> = ({ member, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{
    days: { date: Date; lunch: boolean; dinner: boolean; guestLunch: number; guestDinner: number; cost: number }[];
    monthTotalMeals: number;
    monthTotalCost: number;
    monthDeposit: number;
    netBalance: number;
  }>({ days: [], monthTotalMeals: 0, monthTotalCost: 0, monthDeposit: 0, netBalance: 0 });
  
  const [mealPrice, setMealPrice] = useState(65);

  const { allMeals, allDeposits, settings, loading: dataLoading } = useData();

  const historyData = useMemo(() => {
    if (dataLoading) return null;
    const currentPrice = settings?.mealPrice || 65;

    const memberDeposits = allDeposits.filter(d => d.memberId === member.id);

    let totalLifetimeMeals = 0;
    let totalLifetimeDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);

    allMeals.forEach(m => {
      const entry = m.entries?.[member.id];
      if (entry) {
        if (entry.lunch) totalLifetimeMeals++;
        if (entry.dinner) totalLifetimeMeals++;
        if (entry.guestLunch) totalLifetimeMeals += entry.guestLunch;
        if (entry.guestDinner) totalLifetimeMeals += entry.guestDinner;
      }
    });
    
    const netBalance = totalLifetimeDeposit - (totalLifetimeMeals * currentPrice);

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    let monthMealsCount = 0;
    let monthDepositAmount = 0;

    memberDeposits.forEach(d => {
       if (d.date.startsWith(selectedMonth)) {
         monthDepositAmount += d.amount;
       }
    });

    const dailyData = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const mealDoc = allMeals.find(m => m.date === dateStr);
      let lunch = false;
      let dinner = false;
      let guestLunch = 0;
      let guestDinner = 0;

      if (mealDoc && mealDoc.entries?.[member.id]) {
        const entry = mealDoc.entries[member.id];
        lunch = entry.lunch;
        dinner = entry.dinner;
        guestLunch = entry.guestLunch || 0;
        guestDinner = entry.guestDinner || 0;
      }

      const dailyTotal = (lunch ? 1 : 0) + (dinner ? 1 : 0) + guestLunch + guestDinner;
      monthMealsCount += dailyTotal;

      return {
        date: day,
        lunch,
        dinner,
        guestLunch,
        guestDinner,
        cost: dailyTotal * currentPrice
      };
    });

    return {
      days: dailyData,
      monthTotalMeals: monthMealsCount,
      monthTotalCost: monthMealsCount * currentPrice,
      monthDeposit: monthDepositAmount,
      netBalance,
      mealPrice: currentPrice
    };
  }, [selectedMonth, member.id, allMeals, allDeposits, settings, dataLoading]);

  useEffect(() => {
    if (historyData) {
      setHistory({
        days: historyData.days,
        monthTotalMeals: historyData.monthTotalMeals,
        monthTotalCost: historyData.monthTotalCost,
        monthDeposit: historyData.monthDeposit,
        netBalance: historyData.netBalance
      });
      setMealPrice(historyData.mealPrice);
      setLoading(false);
    }
  }, [historyData]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 w-full h-[95vh] md:h-[90vh] md:max-w-4xl rounded-t-3xl md:rounded-3xl flex flex-col relative z-10 animate-in slide-in-from-bottom duration-300 shadow-2xl">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold">
                {member.fullName.charAt(0)}
             </div>
             <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white leading-tight">{member.fullName}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">{member.phone}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
            <X className="h-5 w-5 stroke-[2.5px]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-6">
             <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-slate-400" />
                   <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="outline-none text-slate-800 dark:text-white font-bold bg-transparent text-sm cursor-pointer"
                  />
                </div>
                <div className={`px-3 py-1 rounded-lg font-bold text-sm ${history.netBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'}`}>
                   Net: {history.netBalance >= 0 ? '+' : ''}{history.netBalance} ৳
                </div>
             </div>

             {/* Stats Grid */}
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-900/40">
                  <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Total Meals</p>
                  <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{history.monthTotalMeals}</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Cost</p>
                   <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400">৳{history.monthTotalCost}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                   <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Deposit</p>
                   <div className="text-xl font-bold text-blue-700 dark:text-blue-400">৳{history.monthDeposit}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                   <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{member.status.toUpperCase()}</div>
                </div>
             </div>
          </div>

          {/* Daily List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daily Breakdown</h3>
            {history.days.map((day) => (
              <div key={day.date.toISOString()} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                 <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{format(day.date, 'dd MMM')}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{format(day.date, 'EEEE')}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    {/* Lunch */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${day.lunch ? 'bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'}`}>
                        <SunMedium className="h-3 w-3" />
                        </div>
                        {day.guestLunch > 0 && <span className="text-[8px] font-bold text-amber-600">G:{day.guestLunch}</span>}
                    </div>
                    {/* Dinner */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${day.dinner ? 'bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'}`}>
                        <MoonStar className="h-3 w-3" />
                        </div>
                        {day.guestDinner > 0 && <span className="text-[8px] font-bold text-indigo-600">G:{day.guestDinner}</span>}
                    </div>
                 </div>
                 <div className="text-sm font-bold text-slate-700 dark:text-slate-300 w-12 text-right">
                    ৳{day.cost}
                 </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// --- Main Members Component ---
export const Members: React.FC = () => {
  const { members, allMeals, allDeposits, settings, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [user, setUser] = useState<firebase.User | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string>(''); // For Modal Validation Errors
  
  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    error?: string;
    loading: boolean;
  }>({ isOpen: false, member: null, loading: false });

  const [formData, setFormData] = useState<Partial<Member>>({
    fullName: '', phone: '', address: '', status: 'active'
  });

  useEffect(() => {
    const authUnsub = auth.onAuthStateChanged((currentUser) => setUser(currentUser));
    return () => { authUnsub(); };
  }, []);

  useEffect(() => {
    setLoading(dataLoading);
  }, [dataLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); // Reset error
    if (!user) return;

    // --- DUPLICATE NUMBER CHECK START ---
    const inputPhone = formData.phone?.trim();
    if (!inputPhone) {
        setFormError("মোবাইল নম্বর দেওয়া আবশ্যক!");
        return;
    }
    const duplicateMember = members.find(m => 
        m.phone === inputPhone && m.id !== selectedMemberId
    );
    if (duplicateMember) {
        setFormError(`এই মোবাইল নম্বরটি (${inputPhone}) ইতিমধ্যে "${duplicateMember.fullName}" ব্যবহার করছেন।`);
        return;
    }
    // --- DUPLICATE NUMBER CHECK END ---

    try {
      if (selectedMemberId) {
        await db.collection('members').doc(selectedMemberId).update(formData);
        await logAction('Update Member', `Updated details for ${formData.fullName}`);
      } else {
        await db.collection('members').add({ ...formData, joinDate: format(new Date(), 'yyyy-MM-dd'), status: 'active' });
        await logAction('Add Member', `Added new member: ${formData.fullName}`);
      }
      closeModal();
    } catch (error) { 
        console.error(error); 
        setFormError("সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  const initiateDelete = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, member, loading: false });
  };

  const proceedWithDelete = async () => {
    if (!deleteModal.member) return;
    setDeleteModal(prev => ({ ...prev, loading: true, error: undefined }));

    const member = deleteModal.member;

    // --- DEBT CHECK START ---
    try {
      const currentPrice = settings?.mealPrice || 65;

      // 2. Calculate Total Deposits
      const memberDeposits = allDeposits.filter(d => d.memberId === member.id);
      let totalDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);

      // 3. Calculate Total Meals
      let totalMeals = 0;
      allMeals.forEach(mDoc => {
        const entry = mDoc.entries?.[member.id];
        if (entry) {
          if (entry.lunch) totalMeals++;
          if (entry.dinner) totalMeals++;
          if (entry.guestLunch) totalMeals += entry.guestLunch;
          if (entry.guestDinner) totalMeals += entry.guestDinner;
        }
      });

      // 4. Calculate Balance
      const totalCost = totalMeals * currentPrice;
      const netBalance = totalDeposit - totalCost;

      if (netBalance < 0) {
        setDeleteModal(prev => ({ 
            ...prev, 
            loading: false, 
            error: `এই মেম্বারকে ডিলিট করা সম্ভব নয়।\n\n${member.fullName}-এর ${Math.abs(netBalance)} টাকা বকেয়া (Due) আছে।\n\nডিলিট করার আগে অবশ্যই সম্পূর্ণ বিল পরিশোধ করতে হবে।` 
        }));
        return;
      }

      // If no debt, proceed with delete
      await db.collection('members').doc(member.id).delete();
      await logAction('Delete Member', `Deleted member ${member.fullName} (Final Balance: ${netBalance})`);
      
      // Close modal
      setDeleteModal({ isOpen: false, member: null, loading: false });

    } catch (err) {
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false, error: "Error checking balance. Please try again." }));
    }
  };

  const openModal = (member?: Member, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    if (!user) return;
    setFormError('');
    if (member) { setSelectedMemberId(member.id); setFormData(member); }
    else { setSelectedMemberId(null); setFormData({ fullName: '', phone: '', address: '', status: 'active' }); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setSelectedMemberId(null); setFormError(''); };

  return (
    <>
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        {viewMember && <MemberHistory member={viewMember} onClose={() => setViewMember(null)} />}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Members</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">
               Manage your <span className="text-indigo-500 font-bold">{members.length}</span> active members
            </p>
          </div>
          {user && (
            <Button onClick={() => openModal()} className="shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 rounded-2xl px-6 py-2.5">
              <UserPlus className="h-5 w-5 stroke-[2px]" />
              Add New
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading members...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {members.map(member => (
              <div 
                key={member.id}
                className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-100/50 dark:shadow-none hover:shadow-2xl transition-all duration-300 group relative overflow-hidden"
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 w-full h-1 ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>

                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl relative ${member.status === 'active' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                      {member.fullName.charAt(0)}
                      {/* Active Pulse */}
                      {member.status === 'active' && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-800"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{member.fullName}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                         <Phone className="h-3 w-3" /> {member.phone}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                     onClick={() => setViewMember(member)}
                     className="p-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm"
                     title="View History"
                  >
                     <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                     <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${member.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-600'}`}>
                        {member.status}
                     </span>
                     {member.address && (
                         <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {member.address}
                         </span>
                     )}
                  </div>

                  {user && (
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => openModal(member, e)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                          title="Edit Profile"
                        >
                           <UserCog className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={(e) => initiateDelete(member, e)}
                          className="p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                          title="Delete Member"
                        >
                           <Trash2 className="h-5 w-5" />
                        </button>
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal (Responsive) */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-md:h-[90vh] max-w-md relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedMemberId ? 'Edit Profile' : 'New Member'}</h3>
               <button onClick={closeModal} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="h-6 w-6 text-slate-400" />
               </button>
             </div>
            
            {/* IN-APP VALIDATION ERROR MESSAGE */}
            {formError && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-4 mb-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-indigo-700 dark:text-indigo-400 font-medium">
                        {formError}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white" placeholder="Full Name" />
              <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white" placeholder="Phone" />
              <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white" placeholder="Address (Optional)" />
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white">
                 <option value="active">Active</option>
                 <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" className="w-full py-3.5 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">Save</Button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.member && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} />
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${deleteModal.error ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'}`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {deleteModal.error ? 'Action Blocked' : 'Delete Member?'}
                        </h3>
                        {deleteModal.error ? (
                            <div className="mt-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl text-left border border-amber-100 dark:border-amber-900/30 whitespace-pre-wrap leading-relaxed">
                                {deleteModal.error}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModal.member?.fullName}</span>? This action cannot be undone.
                            </p>
                        )}
                    </div>
                    
                    <div className="flex gap-3 w-full mt-2">
                        {deleteModal.error ? (
                            <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} className="flex-1 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 border-0">
                                Close
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} className="flex-1 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" disabled={deleteModal.loading}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={proceedWithDelete} isLoading={deleteModal.loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                                    Delete
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

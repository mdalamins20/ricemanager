import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { Button } from '../components/Button';
import { 
  UserPlus, UserCog, Trash2, Phone, MapPin, X, UsersRound, 
  Lock, Calendar, ChevronRight, AlertTriangle, CheckCircle2, 
  History, MoreVertical, Edit3, Camera
} from 'lucide-react';
import { Member, DailyMealDoc, AppSettings, Deposit } from '../types';
import { format } from 'date-fns';
import { logAction } from '../utils/logger';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';

import { MemberHistory } from '../components/Members/MemberHistory';

// --- Main Members Component ---
export const Members: React.FC = () => {
  const { members, loading: membersLoading } = useMembers();
  const { allMeals, loading: mealsLoading } = useMeals();
  const { allDeposits, loading: depositsLoading } = useDeposits();
  const { settings, loading: settingsLoading } = useSettings();
  const dataLoading = membersLoading || mealsLoading || depositsLoading || settingsLoading;
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [user, setUser] = useState<firebase.User | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string>('');
  
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    error?: string;
    loading: boolean;
  }>({ isOpen: false, member: null, loading: false });

  const [formData, setFormData] = useState<Partial<Member>>({
    fullName: '', phone: '', address: '', status: 'active', photoBase64: ''
  });

  useEffect(() => {
    const authUnsub = auth.onAuthStateChanged((currentUser) => setUser(currentUser));
    return () => { authUnsub(); };
  }, []);

  useEffect(() => {
    setLoading(dataLoading);
  }, [dataLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        setFormData(prev => ({ ...prev, photoBase64: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!user) return;

    const inputPhone = formData.phone?.trim();
    if (!inputPhone) {
        setFormError("মোবাইল নম্বর দেওয়া আবশ্যক!");
        return;
    }
    const duplicateMember = members.find(m => m.phone === inputPhone && m.id !== selectedMemberId);
    if (duplicateMember) {
        setFormError(`এই মোবাইল নম্বরটি (${inputPhone}) ইতিমধ্যে "${duplicateMember.fullName}" ব্যবহার করছেন।`);
        return;
    }

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

    try {
      const currentPrice = settings?.mealPrice || 65;
      const memberDeposits = allDeposits.filter(d => d.memberId === member.id);
      let totalDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);

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

      await db.collection('members').doc(member.id).delete();
      await logAction('Delete Member', `Deleted member ${member.fullName} (Final Balance: ${netBalance})`);
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
    else { setSelectedMemberId(null); setFormData({ fullName: '', phone: '', address: '', status: 'active', photoBase64: '' }); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setSelectedMemberId(null); setFormError(''); };

  return (
    <>
      <div className="h-full flex flex-col max-w-7xl mx-auto w-full animate-in fade-in duration-500">
        {viewMember && <MemberHistory member={viewMember} onClose={() => setViewMember(null)} />}

        {/* Page Header */}
        <div className="flex-none mb-6 md:mb-10 bg-white dark:bg-slate-800/50 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex items-center gap-4">
                 <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
                     <UsersRound className="h-7 w-7 stroke-[2px]" />
                 </div>
                 <div>
                     <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Members</h2>
                     <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400">{members.length}</span> ACTIVE MEMBERS
                     </p>
                 </div>
            </div>
            
            {user && (
                <Button onClick={() => openModal()} className="relative z-10 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 rounded-2xl px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all w-full sm:w-auto flex items-center justify-center font-bold">
                    <UserPlus className="h-5 w-5 stroke-[2.5px] mr-2" />
                    Add New Member
                </Button>
            )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {loading ? (
          <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading members...</p>
              </div>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <UsersRound className="h-16 w-16 mb-4 opacity-20" />
              <p className="font-bold text-lg">No members found.</p>
              <p className="text-sm">Click "Add New Member" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
            {members.map(member => (
              <div 
                key={member.id}
                onClick={() => setViewMember(member)}
                className="group relative bg-white dark:bg-slate-800/80 rounded-[1.5rem] p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:bg-slate-800 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-sm flex flex-col justify-between h-full"
              >
                {/* Subtle Background Accent */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>

                <div className="relative z-10 flex gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className={`h-14 w-14 rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-sm border transition-colors ${member.status === 'active' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700'}`}>
                            {member.photoBase64 ? (
                                <img src={member.photoBase64} alt={member.fullName} className="h-full w-full object-cover rounded-[1.25rem]" />
                            ) : (
                                member.fullName.charAt(0)
                            )}
                        </div>
                        {/* Status Dot */}
                        <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-800 ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate pr-2">
                                {member.fullName}
                            </h3>
                            <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 stroke-[2.5px] transition-transform group-hover:translate-x-1 shrink-0 mt-0.5" />
                        </div>

                        <div className="mt-1 space-y-0.5">
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                                <Phone className="h-3 w-3 shrink-0" /> <span>{member.phone}</span>
                            </p>
                            {member.address && (
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" /> <span>{member.address}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${member.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                        {member.status}
                    </div>

                    {user && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -my-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); openModal(member, e); }}
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                                title="Edit Profile"
                            >
                                <Edit3 className="h-4 w-4 stroke-[2px]" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); initiateDelete(member, e); }}
                                className="p-2 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                                title="Delete Member"
                            >
                                <Trash2 className="h-4 w-4 stroke-[2px]" />
                            </button>
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

      {/* Add/Edit Modal (Floating Labels & Premium Design) */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-[95%] sm:max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
             
             {/* Header */}
             <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-12 -mr-12 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white relative z-10">{selectedMemberId ? 'Edit Profile' : 'New Member'}</h3>
                <button onClick={closeModal} className="p-2 bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-full transition-colors relative z-10 shadow-sm border border-slate-100 dark:border-slate-600">
                   <X className="h-4 w-4" />
                </button>
             </div>
            
             <div className="p-6 overflow-y-auto max-h-[75vh] no-scrollbar">
                {/* Validation Error */}
                {formError && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 mb-6 flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                        <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-rose-700 dark:text-rose-400 font-bold leading-relaxed">
                            {formError}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Image Uploader */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <div className="relative group cursor-pointer">
                            <div className="h-28 w-28 rounded-full border-4 border-slate-50 dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                                {formData.photoBase64 ? (
                                    <img src={formData.photoBase64} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <Camera className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                                )}
                            </div>
                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="h-8 w-8 text-white" />
                            </div>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Upload Photo" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Profile Photo</span>
                    </div>

                    {/* Floating Label: Full Name */}
                    <div className="relative group">
                        <input
                            type="text"
                            id="fullName"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                            className="block px-5 pb-3 pt-6 w-full text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 peer transition-all shadow-sm"
                            placeholder=" "
                        />
                        <label htmlFor="fullName" className="absolute text-sm text-slate-500 dark:text-slate-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400 font-bold pointer-events-none">Full Name</label>
                    </div>

                    {/* Floating Label: Phone */}
                    <div className="relative group">
                        <input
                            type="tel"
                            id="phone"
                            required
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="block px-5 pb-3 pt-6 w-full text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 peer transition-all shadow-sm"
                            placeholder=" "
                        />
                        <label htmlFor="phone" className="absolute text-sm text-slate-500 dark:text-slate-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400 font-bold pointer-events-none">Phone Number</label>
                    </div>

                    {/* Floating Label: Address */}
                    <div className="relative group">
                        <input
                            type="text"
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            className="block px-5 pb-3 pt-6 w-full text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 peer transition-all shadow-sm"
                            placeholder=" "
                        />
                        <label htmlFor="address" className="absolute text-sm text-slate-500 dark:text-slate-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400 font-bold pointer-events-none">Address (Optional)</label>
                    </div>

                    {/* Select Status */}
                    <div className="relative group">
                        <select 
                            value={formData.status} 
                            onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                            className="block px-5 py-4 w-full text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                        >
                            <option value="active">Active Member</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-slate-500">
                            <ChevronRight className="h-5 w-5 rotate-90" />
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" className="w-full py-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-emerald-900/20 text-base font-bold transition-transform hover:-translate-y-0.5">
                            <CheckCircle2 className="h-5 w-5 mr-2 stroke-[2.5px]" /> Save Member
                        </Button>
                    </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.member && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} />
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-[95%] sm:max-w-sm relative z-10 p-8 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 overflow-hidden">
                
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 to-orange-500"></div>

                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`h-16 w-16 rounded-[1.5rem] flex items-center justify-center shadow-lg ${deleteModal.error ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/30' : 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/30'}`}>
                        <AlertTriangle className="h-8 w-8 stroke-[2px]" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {deleteModal.error ? 'Action Blocked' : 'Delete Member?'}
                        </h3>
                        {deleteModal.error ? (
                            <div className="mt-4 text-sm text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl text-left border border-orange-200 dark:border-orange-900/30 font-medium leading-relaxed">
                                {deleteModal.error}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                                Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModal.member?.fullName}</span>? This action cannot be undone and will remove them permanently.
                            </p>
                        )}
                    </div>
                    
                    <div className="flex gap-3 w-full mt-6">
                        {deleteModal.error ? (
                            <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 border-0">
                                Close
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, member: null, loading: false })} className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 border-0" disabled={deleteModal.loading}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={proceedWithDelete} isLoading={deleteModal.loading} className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/20">
                                    Delete
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      </div>
    </>
  );
};

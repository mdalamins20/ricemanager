
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { Button } from '../components/Button';
import { WalletCards, Plus, Trash2, Calendar, User as UserIcon, Lock, ArrowDownLeft, AlertTriangle, X } from 'lucide-react';
import { Member, Deposit } from '../types';
import { format } from 'date-fns';
import { logAction } from '../utils/logger';

export const Money: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<(Deposit & { memberName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<firebase.User | null>(null);
  
  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    deposit: (Deposit & { memberName: string }) | null;
  }>({ isOpen: false, deposit: null });
  
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: ''
  });

  useEffect(() => {
    const authUnsub = auth.onAuthStateChanged((currentUser) => setUser(currentUser));
    const fetchData = async () => {
      const mSnap = await db.collection('members').where('status', '==', 'active').get();
      const membersList = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(membersList);
      if (membersList.length > 0 && !formData.memberId) setFormData(prev => ({ ...prev, memberId: membersList[0].id }));

      const unsubscribe = db.collection('deposits').orderBy('date', 'desc').onSnapshot((snapshot) => {
        const depositList = snapshot.docs.map(doc => {
          const data = doc.data() as Deposit;
          const member = membersList.find(m => m.id === data.memberId);
          return { ...data, id: doc.id, memberName: member ? member.fullName : 'Unknown' };
        });
        setDeposits(depositList);
        setLoading(false);
      });
      return unsubscribe;
    };
    const dataUnsubPromise = fetchData();
    return () => { authUnsub(); dataUnsubPromise.then(unsub => unsub && unsub()); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.memberId || !formData.amount) return;
    try {
      await db.collection('deposits').add({
        memberId: formData.memberId, amount: Number(formData.amount), date: formData.date, note: formData.note, createdAt: new Date().toISOString()
      });
      const memberName = members.find(m => m.id === formData.memberId)?.fullName || 'Unknown';
      await logAction('Add Deposit', `Added ${formData.amount} BDT for ${memberName}`);
      
      setIsModalOpen(false); setFormData(prev => ({ ...prev, amount: '', note: '' }));
    } catch (error) { console.error(error); }
  };

  const initiateDelete = (deposit: Deposit & { memberName: string }) => {
    if (!user) return;
    setDeleteModal({ isOpen: true, deposit });
  };

  const confirmDelete = async () => {
    if (!deleteModal.deposit) return;
    try {
      await db.collection('deposits').doc(deleteModal.deposit.id).delete();
      await logAction('Delete Deposit', `Removed deposit of ${deleteModal.deposit.amount} BDT for ${deleteModal.deposit.memberName}`);
      setDeleteModal({ isOpen: false, deposit: null });
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Deposits</h2>
        {user && (
          <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm">
            <Plus className="h-4 w-4 stroke-[2px]" /> Add
          </Button>
        )}
      </div>

      <div className="md:bg-white md:dark:bg-slate-800 md:rounded-2xl md:shadow-sm md:border md:border-slate-200 md:dark:border-slate-700 md:overflow-hidden">
          {/* Desktop Table */}
          <table className="hidden md:table w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Date</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Member</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase">Note</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deposits.map(deposit => (
                <tr key={deposit.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{format(new Date(deposit.date), 'dd MMM, yyyy')}</td>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{deposit.memberName}</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">+৳{deposit.amount}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-500">{deposit.note}</td>
                  <td className="px-6 py-4 text-right">{user && <button onClick={() => initiateDelete(deposit)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="h-4 w-4 text-slate-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile List View */}
          <div className="md:hidden flex flex-col gap-3">
             {deposits.map(deposit => (
               <div key={deposit.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <ArrowDownLeft className="h-5 w-5" />
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{deposit.memberName}</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{format(new Date(deposit.date), 'dd MMM')} • {deposit.note || 'Deposit'}</p>
                     </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">+৳{deposit.amount}</span>
                     {user && (
                       <button onClick={() => initiateDelete(deposit)} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                       </button>
                     )}
                  </div>
               </div>
             ))}
           </div>
        </div>

      {/* Add Modal */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add Deposit</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                   <X className="h-6 w-6" />
                </button>
             </div>
             <form onSubmit={handleSubmit} className="space-y-4">
               <select value={formData.memberId} onChange={e => setFormData({...formData, memberId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white">
                 {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
               </select>
               <input type="number" required placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
               <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
               <input type="text" placeholder="Note (Optional)" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dark:text-white" />
               <Button type="submit" className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">Save</Button>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.deposit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, deposit: null })} />
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-sm relative z-10 p-6 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Transaction?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Permanently remove deposit of <span className="font-bold text-slate-800 dark:text-slate-200">৳{deleteModal.deposit.amount}</span> from <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModal.deposit.memberName}</span>?
                        </p>
                    </div>
                    
                    <div className="flex gap-3 w-full mt-2">
                        <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, deposit: null })} className="flex-1 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 dark:shadow-red-900/20">
                            Delete
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

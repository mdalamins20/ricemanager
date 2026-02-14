import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Plus, Edit2, Trash2, Phone, MapPin, Calendar, X, User } from 'lucide-react';
import { Member } from '../types';
import { format } from 'date-fns';

export const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Member>>({
    fullName: '',
    phone: '',
    address: '',
    status: 'active'
  });

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('fullName'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMembers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(fetchedMembers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'members', editingId), formData);
      } else {
        await addDoc(collection(db, 'members'), {
          ...formData,
          joinDate: format(new Date(), 'yyyy-MM-dd'),
          status: 'active'
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving member:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      try {
        await deleteDoc(doc(db, 'members', id));
      } catch (error) {
        console.error("Error deleting member:", error);
      }
    }
  };

  const openModal = (member?: Member) => {
    if (member) {
      setEditingId(member.id);
      setFormData(member);
    } else {
      setEditingId(null);
      setFormData({ fullName: '', phone: '', address: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Members</h2>
          <p className="text-slate-500 text-sm">Total: {members.length} members</p>
        </div>
        <Button onClick={() => openModal()} className="shadow-red-200">
          <Plus className="h-5 w-5" />
          <span className="hidden md:inline">Add Member</span>
          <span className="md:hidden">Add</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
      ) : (
        <>
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-red-50/50 border-b border-red-100 text-xs uppercase text-red-600 font-bold">
                <th className="px-6 py-4">Member Info</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{member.fullName}</div>
                    {member.address && <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3"/>{member.address}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{member.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {member.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{member.joinDate}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(member)} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(member.id)} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No members found.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {members.map((member) => (
            <div key={member.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User className="h-5 w-5" />
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-800">{member.fullName}</h3>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                           <Phone className="h-3 w-3" /> {member.phone}
                        </div>
                     </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {member.status}
                  </span>
               </div>
               
               {member.address && (
                 <div className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 p-2 rounded-lg">
                    <MapPin className="h-3 w-3 text-red-400" /> {member.address}
                 </div>
               )}

               <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                  <span className="text-xs text-slate-400">Joined: {member.joinDate}</span>
                  <div className="flex gap-2">
                      <button onClick={() => openModal(member)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg active:scale-95 transition">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(member.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg active:scale-95 transition">
                        Delete
                      </button>
                  </div>
               </div>
            </div>
          ))}
          {members.length === 0 && <div className="text-center p-8 text-slate-500 bg-white rounded-xl">No members found.</div>}
        </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Member' : 'Add New Member'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karim Ahmed"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="017..."
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address (Optional)</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as 'active'|'inactive'})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white text-base"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" onClick={closeModal} className="flex-1 py-3">Cancel</Button>
                <Button type="submit" className="flex-1 py-3">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
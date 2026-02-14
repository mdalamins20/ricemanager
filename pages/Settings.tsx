import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { AppSettings } from '../types';

export const Settings: React.FC = () => {
  const [price, setPrice] = useState<number>(65);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPrice((docSnap.data() as AppSettings).mealPrice);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        mealPrice: Number(price)
      });
      alert('Settings updated successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-100 rounded-lg">
           <SettingsIcon className="h-6 w-6 text-slate-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-slate-500">Configure global application parameters</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Meal Pricing</h3>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Meal Price (BDT)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-medium">৳</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This price will be used to calculate the monthly payable amount for all members.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" isLoading={saving}>
              <Save className="h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
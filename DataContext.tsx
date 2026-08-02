
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { Member, DailyMealDoc, Deposit, AppSettings } from './types';
import { format } from 'date-fns';

interface DataContextType {
  members: Member[];
  allMeals: DailyMealDoc[];
  allDeposits: Deposit[];
  settings: AppSettings | null;
  loading: boolean;
  messName: string;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allMeals, setAllMeals] = useState<DailyMealDoc[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [messName, setMessName] = useState('RiceMgr');
  const [autoPopulated, setAutoPopulated] = useState(false);

  useEffect(() => {
    // 1. Listen to Members
    const unsubMembers = db.collection('members').onSnapshot(snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(data);
    });

    // 2. Listen to Meals
    const unsubMeals = db.collection('meals').onSnapshot(snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyMealDoc));
      setAllMeals(data);
    });

    // 3. Listen to Deposits
    const unsubDeposits = db.collection('deposits').onSnapshot(snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit));
      setAllDeposits(data);
    });

    // 4. Listen to Settings
    const unsubSettings = db.collection('settings').doc('config').onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data() as AppSettings;
        setSettings(data);
        if (data.messName) setMessName(data.messName);
      }
      setLoading(false); // Initial load complete
    });

    return () => {
      unsubMembers();
      unsubMeals();
      unsubDeposits();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    // Only auto-populate if data is loaded, members exist, and we haven't done it yet
    if (loading || autoPopulated || members.length === 0) return;

    const checkAndAutoPopulate = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return; // Only logged-in users can trigger auto-populate

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayMealExists = allMeals.some(m => m.date === todayStr);

        if (!todayMealExists) {
            const activeMembers = members.filter(m => m.status === 'active');
            if (activeMembers.length > 0) {
                const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch: number; guestDinner: number }> = {};
                activeMembers.forEach(m => {
                    const defaultMeals = m.defaultMeals || { lunch: true, dinner: true };
                    currentEntries[m.id] = { lunch: defaultMeals.lunch, dinner: defaultMeals.dinner, guestLunch: 0, guestDinner: 0 };
                });
                
                try {
                    await db.collection('meals').doc(todayStr).set({
                        date: todayStr,
                        entries: currentEntries
                    }, { merge: true });
                } catch (err) {
                    console.error("Auto-populate error for today:", err);
                }
            }
        }
        setAutoPopulated(true);
    };

    checkAndAutoPopulate();
  }, [loading, autoPopulated, members, allMeals]);

  return (
    <DataContext.Provider value={{ members, allMeals, allDeposits, settings, loading, messName }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

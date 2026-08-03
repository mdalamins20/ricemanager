import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { Member, DailyMealDoc, Deposit, AppSettings } from './types';
import { format } from 'date-fns';

interface MembersContextType { members: Member[]; loading: boolean; }
interface MealsContextType { allMeals: DailyMealDoc[]; loading: boolean; }
interface DepositsContextType { allDeposits: Deposit[]; loading: boolean; }
interface SettingsContextType { settings: AppSettings | null; messName: string; loading: boolean; }

const MembersContext = createContext<MembersContextType | undefined>(undefined);
const MealsContext = createContext<MealsContextType | undefined>(undefined);
const DepositsContext = createContext<DepositsContextType | undefined>(undefined);
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allMeals, setAllMeals] = useState<DailyMealDoc[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [membersLoading, setMembersLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [messName, setMessName] = useState('RiceMgr');
  const [autoPopulated, setAutoPopulated] = useState(false);

  useEffect(() => {
    const unsubMembers = db.collection('members').onSnapshot(snap => {
      setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
      setMembersLoading(false);
    });

    const unsubMeals = db.collection('meals').onSnapshot(snap => {
      setAllMeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyMealDoc)));
      setMealsLoading(false);
    });

    const unsubDeposits = db.collection('deposits').onSnapshot(snap => {
      setAllDeposits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit)));
      setDepositsLoading(false);
    });

    const unsubSettings = db.collection('settings').doc('config').onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data() as AppSettings;
        setSettings(data);
        if (data.messName) setMessName(data.messName);
      }
      setSettingsLoading(false);
    });

    return () => { unsubMembers(); unsubMeals(); unsubDeposits(); unsubSettings(); };
  }, []);

  useEffect(() => {
    if (membersLoading || mealsLoading || autoPopulated || members.length === 0) return;

    const checkAndAutoPopulate = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return; 

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (!allMeals.some(m => m.date === todayStr)) {
            const activeMembers = members.filter(m => m.status === 'active');
            if (activeMembers.length > 0) {
                const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch: number; guestDinner: number }> = {};
                activeMembers.forEach(m => {
                    const defaultMeals = m.defaultMeals || { lunch: true, dinner: true };
                    currentEntries[m.id] = { lunch: defaultMeals.lunch, dinner: defaultMeals.dinner, guestLunch: 0, guestDinner: 0 };
                });
                
                try {
                    await db.collection('meals').doc(todayStr).set({ date: todayStr, entries: currentEntries }, { merge: true });
                } catch (err) {
                    console.error("Auto-populate error:", err);
                }
            }
        }
        setAutoPopulated(true);
    };

    checkAndAutoPopulate();
  }, [membersLoading, mealsLoading, autoPopulated, members, allMeals]);

  return (
    <SettingsContext.Provider value={{ settings, messName, loading: settingsLoading }}>
      <MembersContext.Provider value={{ members, loading: membersLoading }}>
        <MealsContext.Provider value={{ allMeals, loading: mealsLoading }}>
          <DepositsContext.Provider value={{ allDeposits, loading: depositsLoading }}>
            {children}
          </DepositsContext.Provider>
        </MealsContext.Provider>
      </MembersContext.Provider>
    </SettingsContext.Provider>
  );
};

export const useMembers = () => {
  const ctx = useContext(MembersContext);
  if (!ctx) throw new Error('useMembers must be used within AppProviders');
  return ctx;
};
export const useMeals = () => {
  const ctx = useContext(MealsContext);
  if (!ctx) throw new Error('useMeals must be used within AppProviders');
  return ctx;
};
export const useDeposits = () => {
  const ctx = useContext(DepositsContext);
  if (!ctx) throw new Error('useDeposits must be used within AppProviders');
  return ctx;
};
export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within AppProviders');
  return ctx;
};

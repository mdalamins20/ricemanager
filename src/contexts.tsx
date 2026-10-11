import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { Member, DailyMealDoc, Deposit, AppSettings, VendorPayment } from './types';
import { format } from 'date-fns';

interface MembersContextType { members: Member[]; loading: boolean; }
interface MealsContextType { allMeals: DailyMealDoc[]; loading: boolean; }
interface DepositsContextType { allDeposits: Deposit[]; loading: boolean; }
interface SettingsContextType { settings: AppSettings | null; messName: string; loading: boolean; }
interface VendorPaymentsContextType { vendorPayments: VendorPayment[]; loading: boolean; }

const MembersContext = createContext<MembersContextType | undefined>(undefined);
const MealsContext = createContext<MealsContextType | undefined>(undefined);
const DepositsContext = createContext<DepositsContextType | undefined>(undefined);
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
const VendorPaymentsContext = createContext<VendorPaymentsContextType | undefined>(undefined);

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allMeals, setAllMeals] = useState<DailyMealDoc[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [membersLoading, setMembersLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [vendorPaymentsLoading, setVendorPaymentsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [messName, setMessName] = useState('RiceMgr');
  const [autoPopulated, setAutoPopulated] = useState(false);

  useEffect(() => {
    const unsubMembers = db.collection('members').onSnapshot(
      snap => {
        setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
        setMembersLoading(false);
      },
      err => {
        console.error('Error in members snapshot listener:', err);
        setMembersLoading(false);
      }
    );

    const unsubMeals = db.collection('meals').onSnapshot(
      snap => {
        setAllMeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyMealDoc)));
        setMealsLoading(false);
      },
      err => {
        console.error('Error in meals snapshot listener:', err);
        setMealsLoading(false);
      }
    );

    const unsubDeposits = db.collection('deposits').onSnapshot(
      snap => {
        setAllDeposits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit)));
        setDepositsLoading(false);
      },
      err => {
        console.error('Error in deposits snapshot listener:', err);
        setDepositsLoading(false);
      }
    );

    const unsubVendorPayments = db.collection('vendor_payments').onSnapshot(
      snap => {
        setVendorPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorPayment)));
        setVendorPaymentsLoading(false);
      },
      err => {
        console.error('Error in vendor payments snapshot listener:', err);
        setVendorPaymentsLoading(false);
      }
    );

    const unsubSettings = db.collection('settings').doc('config').onSnapshot(
      doc => {
        if (doc.exists) {
          const data = doc.data() as AppSettings;
          setSettings(data);
          if (data.messName) setMessName(data.messName);
        }
        setSettingsLoading(false);
      },
      err => {
        console.error('Error in settings snapshot listener:', err);
        setSettingsLoading(false);
      }
    );

    return () => { unsubMembers(); unsubMeals(); unsubDeposits(); unsubVendorPayments(); unsubSettings(); };
  }, []);

  useEffect(() => {
    if (membersLoading || mealsLoading || autoPopulated || members.length === 0) return;

    const checkAndAutoPopulate = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return; 

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        // If today's document is already loaded in allMeals memory, it definitely exists. Never overwrite!
        if (allMeals.some(m => m.date === todayStr || m.id === todayStr)) {
            setAutoPopulated(true);
            return;
        }

        const docRef = db.collection('meals').doc(todayStr);
        const activeMembers = members.filter(m => m.status === 'active');
        if (activeMembers.length === 0) {
            setAutoPopulated(true);
            return;
        }

        const currentEntries: Record<string, { lunch: boolean; dinner: boolean; guestLunch: number; guestDinner: number }> = {};
        activeMembers.forEach(m => {
            const defaultLunch = m.defaultMeals?.lunch ?? true;
            const defaultDinner = m.defaultMeals?.dinner ?? true;
            currentEntries[m.id] = { lunch: defaultLunch, dinner: defaultDinner, guestLunch: 0, guestDinner: 0 };
        });
        
        try {
            // Atomic transaction guarantees we never overwrite if another device already created/edited it
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists) {
                    transaction.set(docRef, { date: todayStr, entries: currentEntries });
                }
            });
        } catch (err) {
            console.error("Safe auto-populate error:", err);
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
            <VendorPaymentsContext.Provider value={{ vendorPayments, loading: vendorPaymentsLoading }}>
              {children}
            </VendorPaymentsContext.Provider>
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
export const useVendorPayments = () => {
  const ctx = useContext(VendorPaymentsContext);
  if (!ctx) throw new Error('useVendorPayments must be used within AppProviders');
  return ctx;
};

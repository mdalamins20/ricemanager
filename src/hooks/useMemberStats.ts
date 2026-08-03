import { useMemo } from 'react';
import { DailyMealDoc, Deposit, AppSettings } from '../types';

export const useMemberStats = (
  memberId: string | null,
  allMeals: DailyMealDoc[],
  allDeposits: Deposit[],
  settings: AppSettings | null,
  targetMonthPrefix?: string // e.g., '2023-10'. If provided, filters by month. Otherwise lifetime.
) => {
  return useMemo(() => {
    if (!memberId) return null;
    const currentPrice = settings?.mealPrice || 65;

    let totalMeals = 0;
    let totalDeposit = 0;
    let advanceDeposit = 0;
    let finalDeposit = 0;

    const memberDeposits = allDeposits.filter(d => d.memberId === memberId);

    memberDeposits.forEach(d => {
      if (!targetMonthPrefix || d.date.startsWith(targetMonthPrefix)) {
        totalDeposit += d.amount;
        if (d.type === 'final') {
          finalDeposit += d.amount;
        } else {
          advanceDeposit += d.amount;
        }
      }
    });

    allMeals.forEach(mDoc => {
      if (!targetMonthPrefix || mDoc.date.startsWith(targetMonthPrefix)) {
        const entry = mDoc.entries?.[memberId];
        if (entry) {
          if (entry.lunch) totalMeals++;
          if (entry.dinner) totalMeals++;
          if (entry.guestLunch) totalMeals += entry.guestLunch;
          if (entry.guestDinner) totalMeals += entry.guestDinner;
        }
      }
    });

    const totalBill = totalMeals * currentPrice;
    const netBalance = totalDeposit - totalBill;

    return {
      totalMeals,
      totalDeposit,
      advanceDeposit,
      finalDeposit,
      totalBill,
      netBalance,
      currentPrice
    };
  }, [memberId, allMeals, allDeposits, settings, targetMonthPrefix]);
};

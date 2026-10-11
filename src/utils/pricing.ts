import { AppSettings, MonthRateConfig } from '../types';

/**
 * Get effective meal rate for a specific month ('yyyy-MM').
 * 
 * Rules:
 * 1. If an exact rate is configured for the month, use it.
 * 2. If not, carry-forward the latest configured rate prior to or on this month (<= monthStr).
 * 3. If no past configured rate exists (e.g. historical months before any config), fall back to default settings.mealPrice (65).
 */
export const getMealRateForMonth = (
  settings: AppSettings | null | undefined,
  monthStr?: string
): number => {
  if (!settings) return 65;

  if (monthStr && settings.monthRates) {
    // 1. Direct match for this exact month
    if (settings.monthRates[monthStr]) {
      const rate = Number(settings.monthRates[monthStr].mealPrice);
      if (!Number.isNaN(rate) && rate > 0) {
        return rate;
      }
    }

    // 2. Carry-forward: find the most recent configured month <= monthStr
    const configuredMonths = Object.keys(settings.monthRates)
      .filter(m => m <= monthStr)
      .sort();

    if (configuredMonths.length > 0) {
      const latestMonth = configuredMonths[configuredMonths.length - 1];
      const rate = Number(settings.monthRates[latestMonth]?.mealPrice);
      if (!Number.isNaN(rate) && rate > 0) {
        return rate;
      }
    }
  }

  return Number(settings.mealPrice) || 65;
};

/**
 * Get full rate configuration for a specific month.
 */
export const getMonthRateConfig = (
  settings: AppSettings | null | undefined,
  monthStr?: string
): MonthRateConfig => {
  if (monthStr && settings?.monthRates) {
    if (settings.monthRates[monthStr]) {
      return settings.monthRates[monthStr];
    }
    const configuredMonths = Object.keys(settings.monthRates)
      .filter(m => m <= monthStr)
      .sort();
    if (configuredMonths.length > 0) {
      const latestMonth = configuredMonths[configuredMonths.length - 1];
      return settings.monthRates[latestMonth];
    }
  }
  const defaultPrice = Number(settings?.mealPrice) || 65;
  return {
    pricingMode: 'per_meal',
    mealPrice: defaultPrice
  };
};

/**
 * Calculate total meal cost with rounding for clean integer currency (BDT / ৳).
 */
export const calculateMealCost = (mealsCount: number, rate: number): number => {
  if (!mealsCount || mealsCount <= 0 || !rate || rate <= 0) return 0;
  return Math.round(mealsCount * rate);
};

/**
 * Format a rate for display (e.g. 65 or 68.33).
 */
export const formatMealRate = (rate: number): string => {
  if (!rate || Number.isNaN(rate)) return '0';
  if (Number.isInteger(rate)) return `${rate}`;
  return rate.toFixed(2);
};

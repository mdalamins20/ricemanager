export interface Member {
  id: string;
  fullName: string;
  phone: string;
  address?: string;
  joinDate: string;
  status: 'active' | 'inactive';
}

export interface MealEntry {
  lunch: boolean;
  dinner: boolean;
}

// Map of memberId -> MealEntry
export interface DailyMealDoc {
  date: string; // YYYY-MM-DD
  entries: Record<string, MealEntry>;
}

export interface AppSettings {
  mealPrice: number;
}

export interface MonthlySummary {
  memberId: string;
  memberName: string;
  totalLunch: number;
  totalDinner: number;
  totalMeals: number;
  payableAmount: number;
}

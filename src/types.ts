export interface Member {
  id: string;
  fullName: string;
  phone: string;
  address?: string;
  joinDate: string;
  status: 'active' | 'inactive';
  defaultMeals?: { lunch: boolean; dinner: boolean };
  photoBase64?: string;
}

export interface MealEntry {
  lunch: boolean;
  dinner: boolean;
  guestLunch?: number;
  guestDinner?: number;
}

// Map of memberId -> MealEntry
export interface DailyMealDoc {
  id: string;
  date: string; // YYYY-MM-DD
  entries: Record<string, MealEntry>;
}

export interface AppSettings {
  mealPrice: number;
  messName?: string;
  youtubeVideoUrl?: string;
}

export interface MonthlySummary {
  memberId: string;
  memberName: string;
  totalLunch: number;
  totalDinner: number;
  totalMeals: number;
  payableAmount: number;
}

export interface Deposit {
  id: string;
  memberId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  type?: 'advance' | 'final';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  action: string;
  details: string;
  performedBy: string; // Email or 'System'
  timestamp: string;
}

export interface VendorPayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

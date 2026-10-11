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

export interface DailyNote {
  id: string;
  text: string;
  timestamp: string;
}

// Map of memberId -> MealEntry
export interface DailyMealDoc {
  id: string;
  date: string; // YYYY-MM-DD
  entries: Record<string, MealEntry>;
  notes?: DailyNote[];
}

export interface MonthRateConfig {
  pricingMode: 'per_meal' | 'monthly_package';
  mealPrice: number; // Effective rate per meal (e.g. 65 or 68.33333333)
  packageAmount?: number; // Total monthly package (e.g. 4100)
  packageDays?: number; // Days in month (e.g. 30)
  packageMeals?: number; // Total standard meals (e.g. 60)
}

export interface AppSettings {
  mealPrice: number; // Default fallback meal price
  messName?: string;
  youtubeVideoUrl?: string;
  vendorName?: string;
  vendorPhone?: string;
  whatsappServerUrl?: string; // Optional Cloudflare Tunnel or external WhatsApp server URL
  monthRates?: Record<string, MonthRateConfig>; // Keyed by 'yyyy-MM', e.g. '2026-10'
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
  forMonth?: string; // YYYY-MM
  note?: string;
  createdAt: string;
}

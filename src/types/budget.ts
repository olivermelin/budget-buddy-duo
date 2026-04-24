export type CategoryId =
  | "mat" | "boende" | "transport" | "noje"
  | "shopping" | "abonnemang" | "resor" | "ovrigt";

export type TransactionType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string; // hsl chunk like "158 64% 42%"
  budget: number; // monthly SEK
  isFixed?: boolean;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  income: number; // monthly SEK
}

export interface Transaction {
  id: string;
  date: string; // ISO
  amount: number; // SEK, positive
  type: TransactionType;
  categoryId: string;
  payerId: string; // person id
  description: string;
  isRecurring?: boolean; // marker if user identifies as subscription
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  targetDate?: string;
  contributions: { id: string; date: string; amount: number }[];
}

export interface Subscription {
  id: string; // derived key
  description: string;
  amount: number;
  categoryId: string;
  occurrences: number;
  lastDate: string;
  status: "active" | "cancelled";
}

export interface Settings {
  householdName: string;
  splitMode: "50/50" | "income";
  theme: "light" | "dark" | "system";
}

export interface AppState {
  settings: Settings;
  persons: [Person, Person];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  subscriptionOverrides: Record<string, "active" | "cancelled">;
}

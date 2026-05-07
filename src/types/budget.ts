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
  ownerId?: string | null; // null/undefined = gemensamt
  contributions: { id: string; date: string; amount: number; personId: string }[];
  snapshots: { id: string; date: string; balance: number; note: string }[];
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

export type LoanType = "mortgage" | "car" | "student" | "personal" | "credit_card" | "other";

export interface LoanPayment {
  id: string;
  date: string;
  amount: number;
  isExtra: boolean;
  note: string;
  personId: string;
}

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  lender: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;       // annual %
  monthlyPayment: number;     // total monthly
  monthlyAmortization: number;
  startDate?: string;
  endDate?: string;
  ownerId?: string | null;    // null = shared
  ownerShare: number;         // % share if shared
  icon: string;
  payments: LoanPayment[];
}

export interface Settings {
  householdName: string;
  splitMode: "50/50" | "income";
  theme: "light" | "dark" | "system";
}

export type ImportRuleMatch = "contains" | "starts_with" | "exact" | "regex";

export interface ImportRule {
  id: string;
  pattern: string;
  matchType: ImportRuleMatch;
  categoryId: string | null;
  payerId: string | null;
  priority: number;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  payerId: string;
  dayOfMonth: number; // 1–31
  isActive: boolean;
  lastGeneratedMonth: string | null; // "YYYY-MM", null = aldrig genererad
}

export interface AppState {
  settings: Settings;
  persons: Person[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  loans: Loan[];
  subscriptionOverrides: Record<string, "active" | "cancelled">;
  recurringTransactions: RecurringTransaction[];
  importRules: ImportRule[];
}

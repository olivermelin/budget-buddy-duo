export type CategoryId =
  | "mat" | "boende" | "transport" | "noje"
  | "shopping" | "abonnemang" | "resor" | "ovrigt";

export type TransactionType = "expense" | "income" | "settlement";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string; // hsl chunk like "158 64% 42%"
  budget: number; // monthly SEK
  isFixed?: boolean;
  isIncome?: boolean;
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
  categoryId?: string; // optional för settlement
  payerId: string; // person id
  description: string;
  receiverId?: string; // för settlement: person som fick pengarna
  isRecurring?: boolean; // marker if user identifies as subscription
  isPrivate?: boolean;   // syns endast för ägaren, ingår inte i split
  ownerId?: string;      // user_id för ägaren (sätts på server för privata)
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  targetDate?: string;
  ownerId?: string | null; // null/undefined = gemensamt
  monthlyContribution?: number; // auto-generera bidrag varje månad om > 0
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
  isPrivate?: boolean;
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
  monthlyFee: number;         // månadsavgift förening
  downPayment?: number;       // kontantinsats
  startDate?: string;
  endDate?: string;
  rateFixedUntil?: string;    // YYYY-MM-DD, när räntebindningen löper ut
  ownerId?: string | null;    // null = shared
  ownerShare: number;         // % share if shared
  icon: string;
  payments: LoanPayment[];
  lastGeneratedMonth?: string | null; // "YYYY-MM", senaste månaden amortering auto-genererats
}

export interface Settings {
  householdName: string;
  splitMode: "50/50" | "income";
  theme: "light" | "dark" | "system";
  payDay: number; // Dag lönen kommer (1–28). 1 = kalendermånad, 25 = 25:e → perioden är föregående 25:e till 24:e.
}

export type ImportRuleMatch = "contains" | "starts_with" | "exact" | "regex";

export interface ImportRule {
  id: string;
  pattern: string;
  matchType: ImportRuleMatch;
  categoryId: string | null;
  payerId: string | null;
  priority: number;
  isPrivate?: boolean;
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
  skippedMonths?: string[];          // "YYYY-MM"-nycklar för månader som ska hoppas över
  isPrivate?: boolean;
  ownerId?: string;
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

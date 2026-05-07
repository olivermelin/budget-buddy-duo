import { AppState, Transaction, Category, Person, SavingsGoal, Settings, Loan, LoanPayment, RecurringTransaction, ImportRule } from "@/types/budget";

const uid = () => crypto.randomUUID();

// ─── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: "ADD_TX"; tx: Omit<Transaction, "id"> & { id?: string } }
  | { type: "UPDATE_TX"; id: string; patch: Partial<Transaction> }
  | { type: "DELETE_TX"; id: string }
  | { type: "UPSERT_CATEGORY"; cat: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { type: "UPSERT_GOAL"; goal: SavingsGoal }
  | { type: "DELETE_GOAL"; goalId: string }
  | { type: "ADD_GOAL_CONTRIB"; goalId: string; amount: number; personId: string }
  | { type: "ADD_GOAL_SNAPSHOT"; goalId: string; balance: number; date: string; note: string }
  | { type: "DELETE_GOAL_SNAPSHOT"; goalId: string; snapshotId: string }
  | { type: "UPSERT_LOAN"; loan: Loan }
  | { type: "DELETE_LOAN"; id: string }
  | { type: "ADD_LOAN_PAYMENT"; loanId: string; payment: Omit<LoanPayment, "id"> & { id?: string } }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "SET_SUB_STATUS"; key: string; status: "active" | "cancelled" }
  | { type: "UPSERT_RECURRING"; rt: RecurringTransaction }
  | { type: "DELETE_RECURRING"; id: string }
  | { type: "MARK_RECURRING_GENERATED"; id: string; month: string }
  | { type: "UPSERT_RULE"; rule: ImportRule }
  | { type: "DELETE_RULE"; id: string }
  | { type: "RESET" }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: AppState };

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_TX":
      return { ...state, transactions: [{ ...action.tx, id: action.tx.id ?? uid() } as Transaction, ...state.transactions] };
    case "UPDATE_TX":
      return { ...state, transactions: state.transactions.map(t => t.id === action.id ? { ...t, ...action.patch } : t) };
    case "DELETE_TX":
      return { ...state, transactions: state.transactions.filter(t => t.id !== action.id) };
    case "UPSERT_CATEGORY": {
      const exists = state.categories.find(c => c.id === action.cat.id);
      return { ...state, categories: exists ? state.categories.map(c => c.id === action.cat.id ? action.cat : c) : [...state.categories, action.cat] };
    }
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter(c => c.id !== action.id) };
    case "UPDATE_PERSON":
      return { ...state, persons: state.persons.map(p => p.id === action.id ? { ...p, ...action.patch } : p) };
    case "UPSERT_GOAL": {
      const exists = state.goals.find(g => g.id === action.goal.id);
      return { ...state, goals: exists ? state.goals.map(g => g.id === action.goal.id ? action.goal : g) : [...state.goals, action.goal] };
    }
    case "DELETE_GOAL":
      return { ...state, goals: state.goals.filter(g => g.id !== action.goalId) } as AppState;
    case "ADD_GOAL_CONTRIB":
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.goalId ? {
          ...g,
          saved: g.saved + action.amount,
          contributions: [{ id: uid(), date: new Date().toISOString(), amount: action.amount, personId: action.personId }, ...g.contributions],
        } : g),
      };
    case "ADD_GOAL_SNAPSHOT":
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.goalId ? {
          ...g,
          saved: action.balance,
          snapshots: [{ id: uid(), date: action.date, balance: action.balance, note: action.note }, ...(g.snapshots ?? [])],
        } : g),
      };
    case "DELETE_GOAL_SNAPSHOT":
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.goalId ? {
          ...g,
          snapshots: (g.snapshots ?? []).filter(s => s.id !== action.snapshotId),
        } : g),
      };
    case "UPSERT_LOAN": {
      const exists = state.loans.find(l => l.id === action.loan.id);
      return { ...state, loans: exists ? state.loans.map(l => l.id === action.loan.id ? action.loan : l) : [...state.loans, action.loan] };
    }
    case "DELETE_LOAN":
      return { ...state, loans: state.loans.filter(l => l.id !== action.id) };
    case "ADD_LOAN_PAYMENT": {
      const pid = action.payment.id ?? uid();
      return {
        ...state,
        loans: state.loans.map(l => l.id === action.loanId ? {
          ...l,
          currentBalance: Math.max(0, l.currentBalance - action.payment.amount),
          payments: [{ ...action.payment, id: pid }, ...l.payments],
        } : l),
      };
    }
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "SET_SUB_STATUS":
      return { ...state, subscriptionOverrides: { ...state.subscriptionOverrides, [action.key]: action.status } };
    case "UPSERT_RECURRING": {
      const exists = state.recurringTransactions.find(r => r.id === action.rt.id);
      return {
        ...state,
        recurringTransactions: exists
          ? state.recurringTransactions.map(r => r.id === action.rt.id ? action.rt : r)
          : [...state.recurringTransactions, action.rt],
      };
    }
    case "DELETE_RECURRING":
      return { ...state, recurringTransactions: state.recurringTransactions.filter(r => r.id !== action.id) };
    case "MARK_RECURRING_GENERATED":
      return {
        ...state,
        recurringTransactions: state.recurringTransactions.map(r =>
          r.id === action.id ? { ...r, lastGeneratedMonth: action.month } : r
        ),
      };
    case "UPSERT_RULE": {
      const exists = state.importRules.find(r => r.id === action.rule.id);
      const next = exists
        ? state.importRules.map(r => r.id === action.rule.id ? action.rule : r)
        : [...state.importRules, action.rule];
      return { ...state, importRules: next.sort((a, b) => b.priority - a.priority) };
    }
    case "DELETE_RULE":
      return { ...state, importRules: state.importRules.filter(r => r.id !== action.id) };
    case "RESET":
    case "CLEAR":
      return { ...state, transactions: [], goals: [], loans: [], subscriptionOverrides: {} };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

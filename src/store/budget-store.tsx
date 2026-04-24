import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { AppState, Transaction, Category, Person, SavingsGoal, Settings } from "@/types/budget";
import { initialState, generateMockTransactions, defaultCategories, defaultPersons, defaultGoals } from "@/data/mock";

const STORAGE_KEY = "budgetbuddy.v1";

const uid = () => Math.random().toString(36).slice(2, 10);

type Action =
  | { type: "ADD_TX"; tx: Omit<Transaction, "id"> }
  | { type: "UPDATE_TX"; id: string; patch: Partial<Transaction> }
  | { type: "DELETE_TX"; id: string }
  | { type: "UPSERT_CATEGORY"; cat: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { type: "UPSERT_GOAL"; goal: SavingsGoal }
  | { type: "DELETE_GOAL"; id: string }
  | { type: "ADD_GOAL_CONTRIB"; goalId: string; amount: number }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "SET_SUB_STATUS"; key: string; status: "active" | "cancelled" }
  | { type: "RESET" }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_TX":
      return { ...state, transactions: [{ ...action.tx, id: uid() }, ...state.transactions] };
    case "UPDATE_TX":
      return { ...state, transactions: state.transactions.map(t => t.id === action.id ? { ...t, ...action.patch } : t) };
    case "DELETE_TX":
      return { ...state, transactions: state.transactions.filter(t => t.id !== action.id) };
    case "UPSERT_CATEGORY": {
      const exists = state.categories.find(c => c.id === action.cat.id);
      return {
        ...state,
        categories: exists
          ? state.categories.map(c => c.id === action.cat.id ? action.cat : c)
          : [...state.categories, action.cat],
      };
    }
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter(c => c.id !== action.id) };
    case "UPDATE_PERSON":
      return {
        ...state,
        persons: state.persons.map(p => p.id === action.id ? { ...p, ...action.patch } : p) as [Person, Person],
      };
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
          contributions: [{ id: uid(), date: new Date().toISOString(), amount: action.amount }, ...g.contributions],
        } : g),
      };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "SET_SUB_STATUS":
      return { ...state, subscriptionOverrides: { ...state.subscriptionOverrides, [action.key]: action.status } };
    case "RESET":
      return {
        ...initialState,
        transactions: generateMockTransactions(),
        categories: defaultCategories,
        persons: defaultPersons,
        goals: defaultGoals,
      };
    case "CLEAR":
      return {
        ...state,
        transactions: [],
        goals: [],
        subscriptionOverrides: {},
      };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

const BudgetCtx = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    if (typeof window === "undefined") return initialState;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as AppState;
    } catch { /* ignore */ }
    return initialState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const t = state.settings.theme;
      const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    if (state.settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [state.settings.theme]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <BudgetCtx.Provider value={value}>{children}</BudgetCtx.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetCtx);
  if (!ctx) throw new Error("useBudget must be used within BudgetProvider");
  return ctx;
}

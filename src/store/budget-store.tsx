import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppState, Transaction, TransactionType, Category, Person, SavingsGoal, Settings } from "@/types/budget";
import { supabase } from "@/lib/supabase";
import { Sentry } from "@/lib/sentry";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "budgetbuddy.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_TX"; tx: Omit<Transaction, "id"> & { id?: string } }
  | { type: "UPDATE_TX"; id: string; patch: Partial<Transaction> }
  | { type: "DELETE_TX"; id: string }
  | { type: "UPSERT_CATEGORY"; cat: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { type: "UPSERT_GOAL"; goal: SavingsGoal }
  | { type: "DELETE_GOAL"; goalId: string }
  | { type: "ADD_GOAL_CONTRIB"; goalId: string; amount: number }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "SET_SUB_STATUS"; key: string; status: "active" | "cancelled" }
  | { type: "RESET" }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: AppState };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
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
      return { ...state, persons: state.persons.map(p => p.id === action.id ? { ...p, ...action.patch } : p) as [Person, Person] };
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
    case "CLEAR":
      return { ...state, transactions: [], goals: [], subscriptionOverrides: {} };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

// ─── Supabase data loading ────────────────────────────────────────────────────

async function loadHouseholdData(householdId: string): Promise<AppState> {
  const [hRes, mRes, catRes, txRes, goalRes, overRes] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("household_members").select("*").eq("household_id", householdId),
    supabase.from("categories").select("*").eq("household_id", householdId).order("sort_order"),
    supabase.from("transactions").select("*").eq("household_id", householdId).order("date", { ascending: false }),
    supabase.from("savings_goals").select("*, savings_contributions(*)").eq("household_id", householdId),
    supabase.from("subscription_overrides").select("*").eq("household_id", householdId),
  ]);

  const members = (mRes.data ?? []) as Record<string, unknown>[];
  const cats = (catRes.data ?? []) as Record<string, unknown>[];
  const txs = (txRes.data ?? []) as Record<string, unknown>[];
  const goals = (goalRes.data ?? []) as Record<string, unknown>[];
  const overrides = (overRes.data ?? []) as Record<string, unknown>[];

  const persons: [Person, Person] = (() => {
    const mapped = members.map((m) => ({
      id: m.user_id as string,
      name: m.display_name as string,
      color: m.person_color as string,
      income: m.income_monthly as number,
    }));
    while (mapped.length < 2) {
      mapped.push({ id: `placeholder-${mapped.length}`, name: `Person ${mapped.length + 1}`, color: "#94a3b8", income: 0 });
    }
    return [mapped[0], mapped[1]] as [Person, Person];
  })();

  const categories: Category[] = cats.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    icon: c.icon as string,
    color: c.color as string,
    budget: c.budget_monthly as number,
    isFixed: c.is_fixed as boolean,
  }));

  const transactions: Transaction[] = txs.map((t) => ({
    id: t.id as string,
    date: t.date as string,
    amount: t.amount as number,
    type: t.type as TransactionType,
    categoryId: (t.category_id ?? "") as string,
    payerId: (t.payer_user_id ?? "") as string,
    description: (t.description ?? "") as string,
    isRecurring: (t.is_recurring ?? false) as boolean,
  }));

  const mappedGoals: SavingsGoal[] = goals.map((g) => ({
    id: g.id as string,
    name: g.name as string,
    icon: g.icon as string,
    target: g.target as number,
    saved: g.saved as number,
    targetDate: (g.target_date ?? undefined) as string | undefined,
    contributions: ((g.savings_contributions ?? []) as Record<string, unknown>[]).map((c) => ({
      id: c.id as string,
      date: c.date as string,
      amount: c.amount as number,
    })),
  }));

  const subscriptionOverrides: Record<string, "active" | "cancelled"> = {};
  for (const o of overrides) {
    subscriptionOverrides[o.transaction_id as string] = o.is_active ? "active" : "cancelled";
  }

  // Theme is device-only — keep from localStorage
  let theme: "light" | "dark" | "system" = "system";
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    theme = saved?.settings?.theme ?? "system";
  } catch { /* ignore */ }

  return {
    settings: {
      householdName: ((hRes.data as Record<string, unknown> | null)?.name ?? "Mitt hushåll") as string,
      splitMode: (((hRes.data as Record<string, unknown> | null)?.split_mode ?? "50/50") as "50/50" | "income"),
      theme,
    },
    persons,
    categories,
    transactions,
    goals: mappedGoals,
    subscriptionOverrides,
  };
}

// ─── Supabase write-through (fire-and-forget) ─────────────────────────────────

async function writeToSupabase(action: Action, householdId: string, userId: string): Promise<void> {
  switch (action.type) {
    case "ADD_TX": {
      const tx = action.tx as Transaction;
      await supabase.from("transactions").insert({
        id: tx.id,
        household_id: householdId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category_id: tx.categoryId || null,
        payer_user_id: tx.payerId || userId,
        description: tx.description,
        is_recurring: tx.isRecurring ?? false,
      });
      return;
    }
    case "UPDATE_TX": {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (action.patch.date !== undefined) patch.date = action.patch.date;
      if (action.patch.amount !== undefined) patch.amount = action.patch.amount;
      if (action.patch.type !== undefined) patch.type = action.patch.type;
      if (action.patch.categoryId !== undefined) patch.category_id = action.patch.categoryId;
      if (action.patch.payerId !== undefined) patch.payer_user_id = action.patch.payerId;
      if (action.patch.description !== undefined) patch.description = action.patch.description;
      if (action.patch.isRecurring !== undefined) patch.is_recurring = action.patch.isRecurring;
      await supabase.from("transactions").update(patch).eq("id", action.id);
      return;
    }
    case "DELETE_TX":
      await supabase.from("transactions").delete().eq("id", action.id);
      return;
    case "UPSERT_CATEGORY":
      await supabase.from("categories").upsert({
        id: action.cat.id,
        household_id: householdId,
        name: action.cat.name,
        icon: action.cat.icon,
        color: action.cat.color,
        budget_monthly: action.cat.budget,
        is_fixed: action.cat.isFixed ?? false,
      });
      return;
    case "DELETE_CATEGORY":
      await supabase.from("categories").delete().eq("id", action.id);
      return;
    case "UPDATE_PERSON":
      await supabase.from("household_members").update({
        ...(action.patch.name !== undefined && { display_name: action.patch.name }),
        ...(action.patch.income !== undefined && { income_monthly: action.patch.income }),
        ...(action.patch.color !== undefined && { person_color: action.patch.color }),
      }).eq("user_id", action.id).eq("household_id", householdId);
      return;
    case "UPSERT_GOAL":
      await supabase.from("savings_goals").upsert({
        id: action.goal.id,
        household_id: householdId,
        name: action.goal.name,
        icon: action.goal.icon,
        target: action.goal.target,
        saved: action.goal.saved,
        target_date: action.goal.targetDate ?? null,
      });
      return;
    case "DELETE_GOAL":
      await supabase.from("savings_goals").delete().eq("id", action.goalId);
      return;
    case "ADD_GOAL_CONTRIB":
      await supabase.from("savings_contributions").insert({
        goal_id: action.goalId,
        user_id: userId,
        amount: action.amount,
        date: new Date().toISOString().split("T")[0],
      });
      await supabase.rpc("increment_goal_saved", { gid: action.goalId, delta: action.amount });
      return;
    case "UPDATE_SETTINGS": {
      const patch: Record<string, unknown> = {};
      if (action.patch.householdName !== undefined) patch.name = action.patch.householdName;
      if (action.patch.splitMode !== undefined) patch.split_mode = action.patch.splitMode;
      if (Object.keys(patch).length > 0) {
        await supabase.from("households").update(patch).eq("id", householdId);
      }
      return;
    }
    case "SET_SUB_STATUS":
      await supabase.from("subscription_overrides").upsert({
        household_id: householdId,
        transaction_id: action.key,
        is_active: action.status === "active",
      }, { onConflict: "household_id,transaction_id" });
      return;
    case "CLEAR":
      await Promise.all([
        supabase.from("transactions").delete().eq("household_id", householdId),
        supabase.from("savings_goals").delete().eq("household_id", householdId),
        supabase.from("subscription_overrides").delete().eq("household_id", householdId),
      ]);
      return;
  }
}

// ─── Empty state (before Supabase loads) ─────────────────────────────────────

const emptyState: AppState = {
  settings: { householdName: "", splitMode: "50/50", theme: "system" },
  persons: [
    { id: "p1", name: "Person 1", color: "#1e3a5f", income: 0 },
    { id: "p2", name: "Person 2", color: "#ec4899", income: 0 },
  ],
  categories: [],
  transactions: [],
  goals: [],
  subscriptionOverrides: {},
};

// ─── Context ──────────────────────────────────────────────────────────────────

const BudgetCtx = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const { householdId, user } = useAuth();
  const [state, internalDispatch] = useReducer(reducer, emptyState);
  const [storeLoading, setStoreLoading] = useState(true);
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;

  const reload = useCallback(async () => {
    const hid = householdIdRef.current;
    if (!hid) return;
    const appState = await loadHouseholdData(hid);
    internalDispatch({ type: "HYDRATE", state: appState });
  }, []);

  // Initial load from Supabase
  useEffect(() => {
    if (!householdId) { setStoreLoading(false); return; }
    setStoreLoading(true);
    loadHouseholdData(householdId)
      .then((appState) => { internalDispatch({ type: "HYDRATE", state: appState }); })
      .finally(() => setStoreLoading(false));
  }, [householdId]);

  // Realtime subscription (cross-device sync)
  // Note: enable Realtime for each table in Supabase Dashboard → Database → Replication
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`hh-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions",    filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories",      filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals",   filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId, reload]);

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

  // Persist only theme to localStorage (data lives in Supabase)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...saved,
        settings: { ...saved.settings, theme: state.settings.theme },
      }));
    } catch { /* ignore */ }
  }, [state.settings.theme]);

  const dispatch = useCallback((action: Action) => {
    // Inject UUID for new transactions so we can forward the same ID to Supabase
    const processed =
      action.type === "ADD_TX" && !action.tx.id
        ? { ...action, tx: { ...action.tx, id: crypto.randomUUID() } }
        : action;

    internalDispatch(processed);

    if (householdIdRef.current && user?.id) {
      writeToSupabase(processed, householdIdRef.current, user.id).catch((err) => {
        console.error("[BudgetStore] Supabase write failed:", err);
        Sentry.captureException(err);
        toast.error("Ändringen kunde inte sparas", {
          description: "Kontrollera din uppkoppling och försök igen.",
          action: { label: "Försök igen", onClick: () => dispatch(action) },
        });
        // Restore correct state from DB
        reload();
      });
    }
  }, [user?.id, reload]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return <BudgetCtx.Provider value={value}>{children}</BudgetCtx.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetCtx);
  if (!ctx) throw new Error("useBudget must be used within BudgetProvider");
  return ctx;
}

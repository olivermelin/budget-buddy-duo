import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppState, Transaction, TransactionType, Category, Person, SavingsGoal, Settings, Loan, LoanPayment, RecurringTransaction } from "@/types/budget";
import { supabase } from "@/lib/supabase";
import { Sentry } from "@/lib/sentry";
import { useAuth } from "@/context/AuthContext";
import { reducer, Action } from "@/store/reducer";

const STORAGE_KEY = "budgetbuddy.v1";

// ─── Supabase data loading ────────────────────────────────────────────────────

async function loadHouseholdData(householdId: string): Promise<AppState> {
  const [hRes, mRes, catRes, txRes, goalRes, overRes, loanRes, recurRes] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("household_members").select("*").eq("household_id", householdId),
    supabase.from("categories").select("*").eq("household_id", householdId).order("sort_order"),
    supabase.from("transactions").select("*").eq("household_id", householdId).order("date", { ascending: false }),
    supabase.from("savings_goals").select("*, savings_contributions(*), savings_snapshots(*)").eq("household_id", householdId),
    supabase.from("subscription_overrides").select("*").eq("household_id", householdId),
    supabase.from("loans").select("*, loan_payments(*)").eq("household_id", householdId),
    supabase.from("recurring_transactions").select("*").eq("household_id", householdId),
  ]);

  const members = (mRes.data ?? []) as Record<string, unknown>[];
  const cats = (catRes.data ?? []) as Record<string, unknown>[];
  const txs = (txRes.data ?? []) as Record<string, unknown>[];
  const goals = (goalRes.data ?? []) as Record<string, unknown>[];
  const overrides = (overRes.data ?? []) as Record<string, unknown>[];
  const loans = ((loanRes as { data?: unknown }).data ?? []) as Record<string, unknown>[];
  const recurs = ((recurRes as { data?: unknown }).data ?? []) as Record<string, unknown>[];

  const persons: Person[] = members.map((m) => ({
    id: m.user_id as string,
    name: m.display_name as string,
    color: m.person_color as string,
    income: m.income_monthly as number,
  }));
  if (persons.length === 0) {
    persons.push({ id: `placeholder-0`, name: "Person 1", color: "#94a3b8", income: 0 });
  }

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
      personId: (c.user_id ?? "") as string,
    })),
    snapshots: ((g.savings_snapshots ?? []) as Record<string, unknown>[]).map((s) => ({
      id: s.id as string,
      date: s.date as string,
      balance: s.balance as number,
      note: (s.note ?? "") as string,
    })).sort((a, b) => b.date.localeCompare(a.date)),
  }));

  const subscriptionOverrides: Record<string, "active" | "cancelled"> = {};
  for (const o of overrides) {
    subscriptionOverrides[o.transaction_id as string] = o.is_active ? "active" : "cancelled";
  }

  let theme: "light" | "dark" | "system" = "system";
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    theme = saved?.settings?.theme ?? "system";
  } catch { /* ignore */ }

  const mappedLoans: Loan[] = loans.map((l) => ({
    id: l.id as string,
    name: l.name as string,
    type: l.type as Loan["type"],
    lender: (l.lender ?? "") as string,
    originalAmount: Number(l.original_amount ?? 0),
    currentBalance: Number(l.current_balance ?? 0),
    interestRate: Number(l.interest_rate ?? 0),
    monthlyPayment: Number(l.monthly_payment ?? 0),
    monthlyAmortization: Number(l.monthly_amortization ?? 0),
    startDate: (l.start_date ?? undefined) as string | undefined,
    endDate: (l.end_date ?? undefined) as string | undefined,
    ownerId: (l.owner_user_id ?? null) as string | null,
    ownerShare: Number(l.owner_share ?? 100),
    icon: (l.icon ?? "💰") as string,
    payments: ((l.loan_payments ?? []) as Record<string, unknown>[]).map((p) => ({
      id: p.id as string,
      date: p.date as string,
      amount: Number(p.amount),
      isExtra: Boolean(p.is_extra),
      note: (p.note ?? "") as string,
      personId: (p.user_id ?? "") as string,
    })).sort((a, b) => b.date.localeCompare(a.date)),
  }));

  const recurringTransactions: RecurringTransaction[] = recurs.map((r) => ({
    id: r.id as string,
    description: (r.description ?? "") as string,
    amount: Number(r.amount),
    type: r.type as TransactionType,
    categoryId: (r.category_id ?? "") as string,
    payerId: (r.payer_user_id ?? "") as string,
    dayOfMonth: Number(r.day_of_month),
    isActive: Boolean(r.is_active),
    lastGeneratedMonth: (r.last_generated_month ?? null) as string | null,
  }));

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
    loans: mappedLoans,
    subscriptionOverrides,
    recurringTransactions,
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
        user_id: action.personId || userId,
        amount: action.amount,
        date: new Date().toISOString().split("T")[0],
      });
      await supabase.rpc("increment_goal_saved", { gid: action.goalId, delta: action.amount });
      return;
    case "ADD_GOAL_SNAPSHOT":
      await supabase.from("savings_snapshots").insert({
        goal_id: action.goalId,
        date: action.date,
        balance: action.balance,
        note: action.note,
      });
      await supabase.from("savings_goals").update({ saved: action.balance }).eq("id", action.goalId);
      return;
    case "DELETE_GOAL_SNAPSHOT":
      await supabase.from("savings_snapshots").delete().eq("id", action.snapshotId);
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
    case "UPSERT_RECURRING":
      await supabase.from("recurring_transactions").upsert({
        id: action.rt.id,
        household_id: householdId,
        description: action.rt.description,
        amount: action.rt.amount,
        type: action.rt.type,
        category_id: action.rt.categoryId || null,
        payer_user_id: action.rt.payerId || userId,
        day_of_month: action.rt.dayOfMonth,
        is_active: action.rt.isActive,
        last_generated_month: action.rt.lastGeneratedMonth ?? null,
      });
      return;
    case "DELETE_RECURRING":
      await supabase.from("recurring_transactions").delete().eq("id", action.id);
      return;
    case "MARK_RECURRING_GENERATED":
      await supabase.from("recurring_transactions")
        .update({ last_generated_month: action.month })
        .eq("id", action.id);
      return;
    case "UPSERT_LOAN":
      await supabase.from("loans").upsert({
        id: action.loan.id,
        household_id: householdId,
        name: action.loan.name,
        type: action.loan.type,
        lender: action.loan.lender,
        original_amount: action.loan.originalAmount,
        current_balance: action.loan.currentBalance,
        interest_rate: action.loan.interestRate,
        monthly_payment: action.loan.monthlyPayment,
        monthly_amortization: action.loan.monthlyAmortization,
        start_date: action.loan.startDate ?? null,
        end_date: action.loan.endDate ?? null,
        owner_user_id: action.loan.ownerId ?? null,
        owner_share: action.loan.ownerShare,
        icon: action.loan.icon,
      });
      return;
    case "DELETE_LOAN":
      await supabase.from("loans").delete().eq("id", action.id);
      return;
    case "ADD_LOAN_PAYMENT":
      await supabase.from("loan_payments").insert({
        id: action.payment.id,
        loan_id: action.loanId,
        user_id: action.payment.personId || userId,
        date: action.payment.date,
        amount: action.payment.amount,
        is_extra: action.payment.isExtra,
        note: action.payment.note,
      });
      await supabase.rpc("decrement_loan_balance", { lid: action.loanId, delta: action.payment.amount });
      return;
    case "CLEAR":
      await Promise.all([
        supabase.from("transactions").delete().eq("household_id", householdId),
        supabase.from("savings_goals").delete().eq("household_id", householdId),
        supabase.from("loans").delete().eq("household_id", householdId),
        supabase.from("subscription_overrides").delete().eq("household_id", householdId),
      ]);
      return;
  }
}

// ─── Recurring transaction auto-generation ───────────────────────────────────

function monthsToGenerate(rt: RecurringTransaction, today: Date): string[] {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-based
  const todayDay = today.getDate();

  let startYear: number;
  let startMonth: number; // 1-based

  if (rt.lastGeneratedMonth) {
    const [y, m] = rt.lastGeneratedMonth.split("-").map(Number);
    // Next month after last generated
    startMonth = m + 1 > 12 ? 1 : m + 1;
    startYear = m + 1 > 12 ? y + 1 : y;
  } else {
    startYear = todayYear;
    startMonth = todayMonth;
  }

  const dates: string[] = [];
  let y = startYear;
  let m = startMonth;

  while (y < todayYear || (y === todayYear && m <= todayMonth)) {
    const isCurrentMonth = y === todayYear && m === todayMonth;
    if (!isCurrentMonth || todayDay >= rt.dayOfMonth) {
      // Clamp day to last day of month (e.g. Feb 28/29)
      const lastDay = new Date(y, m, 0).getDate();
      const day = Math.min(rt.dayOfMonth, lastDay);
      dates.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }

  return dates;
}

// ─── Empty state (before Supabase loads) ─────────────────────────────────────

const emptyState: AppState = {
  settings: { householdName: "", splitMode: "50/50", theme: "system" },
  persons: [],
  categories: [],
  transactions: [],
  goals: [],
  loans: [],
  subscriptionOverrides: {},
  recurringTransactions: [],
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
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  const reloadInProgress = useRef(false);

  const reload = useCallback(async () => {
    if (reloadInProgress.current) return;
    const hid = householdIdRef.current;
    if (!hid) return;
    reloadInProgress.current = true;
    try {
      const appState = await loadHouseholdData(hid);
      internalDispatch({ type: "HYDRATE", state: appState });
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      reloadInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    if (!householdId) { setStoreLoading(false); return; }
    setStoreLoading(true);
    loadHouseholdData(householdId)
      .then((appState) => { internalDispatch({ type: "HYDRATE", state: appState }); })
      .catch((err) => {
        console.error("[BudgetStore] Initial load failed:", err);
        Sentry.captureException(err);
        toast.error("Kunde inte ladda data", { description: "Kontrollera uppkopplingen och ladda om sidan." });
      })
      .finally(() => setStoreLoading(false));
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`hh-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions",      filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories",        filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals",     filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "loans",                   filter: `household_id=eq.${householdId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_transactions",  filter: `household_id=eq.${householdId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId, reload]);

  // Auto-generate recurring transactions on load
  useEffect(() => {
    if (storeLoading) return;
    const today = new Date();
    const active = state.recurringTransactions.filter(r => r.isActive);
    if (active.length === 0) return;

    for (const rt of active) {
      const dates = monthsToGenerate(rt, today);
      if (dates.length === 0) continue;

      for (const date of dates) {
        dispatch({
          type: "ADD_TX",
          tx: {
            date,
            amount: rt.amount,
            type: rt.type,
            categoryId: rt.categoryId,
            payerId: rt.payerId,
            description: rt.description,
            isRecurring: true,
          },
        });
      }

      const latestMonth = dates[dates.length - 1].slice(0, 7); // "YYYY-MM"
      dispatch({ type: "MARK_RECURRING_GENERATED", id: rt.id, month: latestMonth });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLoading]);

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
    const processed =
      action.type === "ADD_TX" && !action.tx.id
        ? { ...action, tx: { ...action.tx, id: crypto.randomUUID() } }
        : action;

    internalDispatch(processed);

    const hid = householdIdRef.current;
    const uid = userRef.current;
    if (hid && uid) {
      writeToSupabase(processed, hid, uid).catch((err) => {
        console.error("[BudgetStore] Supabase write failed:", err);
        Sentry.captureException(err);
        toast.error("Ändringen kunde inte sparas", {
          description: "Kontrollera din uppkoppling och försök igen.",
          action: { label: "Försök igen", onClick: () => dispatch(processed) },
        });
        reload();
      });
    }
  }, [reload]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="h-6 w-6 text-white" />
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

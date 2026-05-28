import { AppState } from "@/types/budget";
import { computeEffectiveBudgets, summarizeMonth, detectSubscriptions } from "./analytics";

export type NotificationSeverity = "info" | "warning" | "success";

export interface AppNotification {
  id: string;             // stable id used for dismiss
  title: string;
  description: string;
  severity: NotificationSeverity;
  href?: string;          // route to navigate to on click
  createdAt: string;      // ISO
}

const DISMISS_KEY = "budgetbuddy.notifications.dismissed";

export function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

export function saveDismissed(ids: Set<string>): void {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

export function buildNotifications(state: AppState): AppNotification[] {
  const out: AppNotification[] = [];
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const monthId = `${y}-${String(m + 1).padStart(2, "0")}`;

  // 1. Budget-överskridanden (rörliga kategorier denna månad)
  const summary = summarizeMonth(state, y, m);
  const budgets = computeEffectiveBudgets(state);
  for (const cat of state.categories) {
    if (cat.isFixed) continue;
    const spent = summary.byCategory[cat.id] ?? 0;
    const budget = budgets[cat.id] ?? 0;
    if (budget <= 0) continue;
    if (spent > budget) {
      const over = spent - budget;
      out.push({
        id: `over:${cat.id}:${monthId}`,
        title: `${cat.icon} ${cat.name} över budget`,
        description: `Du ligger ${Math.round(over).toLocaleString("sv-SE")} kr över budget denna månad.`,
        severity: "warning",
        href: "/budget",
        createdAt: today.toISOString(),
      });
    } else if (budget > 0 && spent / budget >= 0.9) {
      out.push({
        id: `near:${cat.id}:${monthId}`,
        title: `${cat.icon} ${cat.name} närmar sig taket`,
        description: `${Math.round((spent / budget) * 100)}% av månadsbudgeten är använd.`,
        severity: "info",
        href: "/budget",
        createdAt: today.toISOString(),
      });
    }
  }

  // 2. Nya föreslagna återkommande mallar (abonnemang utan motsvarande mall)
  const subs = detectSubscriptions(state).filter(s => s.status === "active");
  const existingDescs = new Set(state.recurringTransactions.map(r => r.description.trim().toLowerCase()));
  const newSubs = subs.filter(s => !existingDescs.has(s.description.trim().toLowerCase()));
  if (newSubs.length > 0) {
    out.push({
      id: `subs:new:${newSubs.map(s => s.id).join("|").slice(0, 80)}`,
      title: `${newSubs.length} nya återkommande utgift${newSubs.length === 1 ? "" : "er"}`,
      description: `Vi hittade ${newSubs.length} mönster som ser ut som abonnemang. Skapa mallar för bättre planering.`,
      severity: "info",
      href: "/statistik",
      createdAt: today.toISOString(),
    });
  }

  // 3. Lån som är nära slutbetalda
  for (const loan of state.loans) {
    if (loan.originalAmount <= 0) continue;
    const left = loan.currentBalance / loan.originalAmount;
    if (loan.currentBalance > 0 && left <= 0.1) {
      out.push({
        id: `loan:near-paid:${loan.id}`,
        title: `${loan.icon} ${loan.name} snart betalt`,
        description: `Bara ${Math.round(left * 100)}% kvar av ursprungsbeloppet.`,
        severity: "success",
        href: "/lan",
        createdAt: today.toISOString(),
      });
    }
  }

  // 4. Sparmål uppnådda
  for (const goal of state.goals) {
    if (goal.target > 0 && goal.saved >= goal.target) {
      out.push({
        id: `goal:reached:${goal.id}`,
        title: `${goal.icon} Sparmål uppnått: ${goal.name}`,
        description: `Du har sparat ihop ${Math.round(goal.saved).toLocaleString("sv-SE")} kr. Grattis!`,
        severity: "success",
        href: "/sparmal",
        createdAt: today.toISOString(),
      });
    }
  }

  return out;
}

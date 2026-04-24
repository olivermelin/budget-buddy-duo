import { AppState, Transaction, Subscription } from "@/types/budget";
import { monthKey } from "./format";

export const inMonth = (iso: string, year: number, month: number) => {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
};

export interface MonthSummary {
  year: number;
  month: number;
  income: number;
  fixed: number;
  variable: number;
  expenses: number;
  savings: number;
  remaining: number;
  byCategory: Record<string, number>;
  byPerson: Record<string, number>;
}

export function summarizeMonth(state: AppState, year: number, month: number): MonthSummary {
  const fixedCats = new Set(state.categories.filter(c => c.isFixed).map(c => c.id));
  const txs = state.transactions.filter(t => inMonth(t.date, year, month));
  let income = 0, fixed = 0, variable = 0;
  const byCategory: Record<string, number> = {};
  const byPerson: Record<string, number> = {};
  for (const t of txs) {
    if (t.type === "income") {
      income += t.amount;
    } else {
      if (fixedCats.has(t.categoryId)) fixed += t.amount;
      else variable += t.amount;
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      byPerson[t.payerId] = (byPerson[t.payerId] || 0) + t.amount;
    }
  }
  const expenses = fixed + variable;
  const remaining = income - expenses;
  return { year, month, income, fixed, variable, expenses, savings: Math.max(0, remaining), remaining, byCategory, byPerson };
}

export function lastNMonths(state: AppState, n: number, ref = new Date()): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(summarizeMonth(state, d.getFullYear(), d.getMonth()));
  }
  return out;
}

export function detectSubscriptions(state: AppState): Subscription[] {
  // Group by normalized description + rounded amount
  const groups: Record<string, Transaction[]> = {};
  for (const t of state.transactions) {
    if (t.type !== "expense") continue;
    const key = `${t.description.trim().toLowerCase()}__${Math.round(t.amount)}`;
    (groups[key] ||= []).push(t);
  }
  const subs: Subscription[] = [];
  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue;
    // Need to occur in at least 2 different months
    const months = new Set(txs.map(t => monthKey(t.date)));
    if (months.size < 2) continue;
    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    const override = state.subscriptionOverrides[key];
    subs.push({
      id: key,
      description: txs[0].description,
      amount: Math.round(txs[0].amount),
      categoryId: txs[0].categoryId,
      occurrences: months.size,
      lastDate: sorted[0].date,
      status: override ?? "active",
    });
  }
  return subs.sort((a, b) => b.amount - a.amount);
}

export function calcSplit(state: AppState, year: number, month: number) {
  const txs = state.transactions.filter(t => t.type === "expense" && inMonth(t.date, year, month));
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const [p1, p2] = state.persons;
  const paid: Record<string, number> = { [p1.id]: 0, [p2.id]: 0 };
  for (const t of txs) paid[t.payerId] = (paid[t.payerId] || 0) + t.amount;

  let share1: number, share2: number;
  if (state.settings.splitMode === "50/50") {
    share1 = total / 2;
    share2 = total / 2;
  } else {
    const totalIncome = p1.income + p2.income || 1;
    share1 = total * (p1.income / totalIncome);
    share2 = total * (p2.income / totalIncome);
  }
  // Diff: positive = personen ligger ute med pengar (har betalat mer än sin andel)
  const diff1 = paid[p1.id] - share1;
  const diff2 = paid[p2.id] - share2;
  // Settlement: if diff1 > 0, p2 owes p1
  const settlement = Math.abs(diff1);
  const owesFrom = diff1 > 0 ? p2.id : p1.id;
  const owesTo = diff1 > 0 ? p1.id : p2.id;
  return { total, paid, share: { [p1.id]: share1, [p2.id]: share2 }, diff: { [p1.id]: diff1, [p2.id]: diff2 }, settlement, owesFrom, owesTo };
}

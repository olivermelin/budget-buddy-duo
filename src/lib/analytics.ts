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

export interface Settlement {
  from: string; // personId who owes
  to: string;   // personId who receives
  amount: number;
}

export function calcSplit(state: AppState, year: number, month: number) {
  const txs = state.transactions.filter(t => t.type === "expense" && inMonth(t.date, year, month));
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const persons = state.persons;

  const paid: Record<string, number> = {};
  for (const p of persons) paid[p.id] = 0;
  for (const t of txs) {
    if (paid[t.payerId] !== undefined) paid[t.payerId] += t.amount;
  }

  const share: Record<string, number> = {};
  if (persons.length === 0) {
    return { total, paid, share, diff: {}, settlements: [] as Settlement[] };
  }

  if (state.settings.splitMode === "50/50") {
    const equal = total / persons.length;
    for (const p of persons) share[p.id] = equal;
  } else {
    const totalIncome = persons.reduce((s, p) => s + p.income, 0) || 1;
    for (const p of persons) share[p.id] = total * (p.income / totalIncome);
  }

  // Diff: positive = ligger ute med pengar (har betalat mer än sin andel)
  const diff: Record<string, number> = {};
  for (const p of persons) diff[p.id] = (paid[p.id] ?? 0) - share[p.id];

  // Greedy pairwise settlement: largest debtor pays largest creditor each step
  const creditors = persons
    .map(p => ({ id: p.id, amount: diff[p.id] }))
    .filter(x => x.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);
  const debtors = persons
    .map(p => ({ id: p.id, amount: -diff[p.id] }))
    .filter(x => x.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amount, debtors[di].amount);
    if (pay > 0.5) {
      settlements.push({ from: debtors[di].id, to: creditors[ci].id, amount: pay });
    }
    creditors[ci].amount -= pay;
    debtors[di].amount -= pay;
    if (creditors[ci].amount < 0.5) ci++;
    if (debtors[di].amount < 0.5) di++;
  }

  return { total, paid, share, diff, settlements };
}

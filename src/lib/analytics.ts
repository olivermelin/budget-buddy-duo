import { AppState, Transaction, Subscription } from "@/types/budget";
import { monthKey } from "./format";

// Privata transaktioner ingår inte i hushållets uppdelning eller delade budget.
// RLS säkerställer att sambon inte ens ser dem; här filtrerar vi för säkerhets skull
// och för att hålla aktuell användares vyer korrekta.
const isShared = (t: { isPrivate?: boolean }) => !t.isPrivate;

// ─── Effektiva kategoribudgetar ───────────────────────────────────────────────
// Fasta kategorier: budget = summa aktiva återkommande utgifter i kategorin
// Rörliga kategorier: budget = det manuellt angivna värdet

export function computeEffectiveBudgets(state: AppState): Record<string, number> {
  const fixedCats = new Set(state.categories.filter(c => c.isFixed).map(c => c.id));
  const fromRecurring: Record<string, number> = {};

  for (const rt of state.recurringTransactions) {
    if (!rt.isActive || rt.type !== "expense") continue;
    if (!isShared(rt)) continue; // privata recurring blåser inte upp delad budget
    if (fixedCats.has(rt.categoryId)) {
      fromRecurring[rt.categoryId] = (fromRecurring[rt.categoryId] ?? 0) + rt.amount;
    }
  }

  const result: Record<string, number> = {};
  for (const c of state.categories) {
    result[c.id] = c.isFixed ? (fromRecurring[c.id] ?? 0) : c.budget;
  }
  return result;
}

// ─── Månadsplan baserad på återkommande mallar ────────────────────────────────

export interface MonthPlan {
  plannedIncome: number;        // Summa aktiva återkommande inkomster
  plannedFixed: number;         // Summa aktiva återkommande fasta utgifter
  plannedFreeToSpend: number;   // plannedIncome − plannedFixed
  actualVariable: number;       // Faktiska rörliga utgifter denna månad
  actualFixed: number;          // Faktiska fasta utgifter denna månad
  remaining: number;            // plannedFreeToSpend − actualVariable
  spendPercent: number;         // actualVariable / plannedFreeToSpend (0–1+)
  hasRecurring: boolean;        // Finns det mallar alls?
}

export function buildMonthPlan(state: AppState, year: number, month: number): MonthPlan {
  const fixedCats = new Set(state.categories.filter(c => c.isFixed).map(c => c.id));

  // Planen avser hushållets delade ekonomi — privata recurring exkluderas.
  let plannedIncome = 0;
  let plannedFixed = 0;
  for (const rt of state.recurringTransactions) {
    if (!rt.isActive) continue;
    if (!isShared(rt)) continue;
    if (rt.type === "income") plannedIncome += rt.amount;
    else plannedFixed += rt.amount;
  }

  const txs = state.transactions.filter(t => inMonth(t.date, year, month));
  let actualVariable = 0;
  let actualFixed = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (!isShared(t)) continue;
    if (isFixedExpense(t, fixedCats)) actualFixed += t.amount;
    else actualVariable += t.amount;
  }

  const plannedFreeToSpend = Math.max(0, plannedIncome - plannedFixed);
  const remaining = plannedFreeToSpend - actualVariable;
  const spendPercent = plannedFreeToSpend > 0 ? actualVariable / plannedFreeToSpend : 0;

  return {
    plannedIncome,
    plannedFixed,
    plannedFreeToSpend,
    actualVariable,
    actualFixed,
    remaining,
    spendPercent,
    hasRecurring: state.recurringTransactions.some(r => r.isActive && isShared(r)),
  };
}

export const inMonth = (iso: string, year: number, month: number) => {
  // Parsa YYYY-MM-DD direkt för att undvika UTC-till-lokal-konvertering.
  // new Date("YYYY-MM-DD") tolkas som UTC-midnatt, vilket i t.ex. UTC-5
  // skiftar den 1:a i månaden till föregående månads sista dag.
  const [y, m] = iso.split("-").map(Number);
  return y === year && m - 1 === month;
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
  /**
   * Endast den aktuella användarens privata utgifter (sambon ser dem inte alls via RLS).
   * Räknas INTE in i `income`/`fixed`/`variable`/`expenses` ovan — de tillhör hushållets delade vy.
   */
  personal: {
    fixed: number;
    variable: number;
    expenses: number;
    byCategory: Record<string, number>;
  };
}

const isFixedExpense = (t: { categoryId: string }, fixedCats: Set<string>) =>
  fixedCats.has(t.categoryId);

export function summarizeMonth(state: AppState, year: number, month: number): MonthSummary {
  const fixedCats = new Set(state.categories.filter(c => c.isFixed).map(c => c.id));
  const txs = state.transactions.filter(t => inMonth(t.date, year, month));
  let income = 0, fixed = 0, variable = 0;
  let personalFixed = 0, personalVariable = 0;
  const byCategory: Record<string, number> = {};
  const byPerson: Record<string, number> = {};
  const personalByCategory: Record<string, number> = {};
  for (const t of txs) {
    if (t.type === "income") {
      if (isShared(t)) income += t.amount;
      continue;
    }
    if (isShared(t)) {
      if (isFixedExpense(t, fixedCats)) fixed += t.amount;
      else variable += t.amount;
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      byPerson[t.payerId] = (byPerson[t.payerId] || 0) + t.amount;
    } else {
      if (isFixedExpense(t, fixedCats)) personalFixed += t.amount;
      else personalVariable += t.amount;
      personalByCategory[t.categoryId] = (personalByCategory[t.categoryId] || 0) + t.amount;
    }
  }
  const expenses = fixed + variable;
  const remaining = income - expenses;
  return {
    year, month, income, fixed, variable, expenses,
    savings: Math.max(0, remaining), remaining, byCategory, byPerson,
    personal: {
      fixed: personalFixed,
      variable: personalVariable,
      expenses: personalFixed + personalVariable,
      byCategory: personalByCategory,
    },
  };
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
      isPrivate: txs.some(t => t.isPrivate),
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
  const fixedCats = new Set(state.categories.filter(c => c.isFixed).map(c => c.id));
  // Privata transaktioner exkluderas helt från delningen — de berör endast ägaren.
  const txs = state.transactions.filter(t => t.type === "expense" && isShared(t) && inMonth(t.date, year, month));
  const persons = state.persons;

  const fixedTxs = txs.filter(t => isFixedExpense(t, fixedCats));
  const variableTxs = txs.filter(t => !isFixedExpense(t, fixedCats));

  const fixedTotal = fixedTxs.reduce((s, t) => s + t.amount, 0);
  const variableTotal = variableTxs.reduce((s, t) => s + t.amount, 0);
  const total = fixedTotal + variableTotal;

  const paid: Record<string, number> = {};
  for (const p of persons) paid[p.id] = 0;
  for (const t of txs) {
    if (paid[t.payerId] !== undefined) paid[t.payerId] += t.amount;
  }

  const fixedShare: Record<string, number> = {};
  const variableShare: Record<string, number> = {};
  const share: Record<string, number> = {};

  if (persons.length === 0) {
    return { total, fixedTotal, variableTotal, paid, fixedShare, variableShare, share, diff: {}, settlements: [] as Settlement[] };
  }

  // Fasta och rörliga utgifter delas båda enligt valt läge (50/50 eller inkomstbaserat)
  if (state.settings.splitMode === "50/50") {
    const equalFixed = fixedTotal / persons.length;
    const equalVariable = variableTotal / persons.length;
    for (const p of persons) { fixedShare[p.id] = equalFixed; variableShare[p.id] = equalVariable; }
  } else {
    const totalIncome = persons.reduce((s, p) => s + p.income, 0) || 1;
    for (const p of persons) {
      fixedShare[p.id] = fixedTotal * (p.income / totalIncome);
      variableShare[p.id] = variableTotal * (p.income / totalIncome);
    }
  }

  for (const p of persons) share[p.id] = fixedShare[p.id] + variableShare[p.id];

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

  return { total, fixedTotal, variableTotal, paid, fixedShare, variableShare, share, diff, settlements };
}

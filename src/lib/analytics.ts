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
  plannedLoans: number;         // Summa lånkostnader (monthlyPayment + monthlyFee)
  plannedSavings: number;       // Summa månadsparande från sparmål
  plannedFreeToSpend: number;   // plannedIncome − plannedFixed − plannedLoans − plannedSavings
  actualVariable: number;       // Faktiska rörliga utgifter denna månad
  actualFixed: number;          // Faktiska fasta utgifter denna månad
  remaining: number;            // plannedFreeToSpend − actualVariable
  spendPercent: number;         // actualVariable / plannedFreeToSpend (0–1+)
  hasRecurring: boolean;        // Finns det mallar alls?
}

export function buildMonthPlan(state: AppState, year: number, month: number): MonthPlan {
  const payDay = state.settings.payDay ?? 1;
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

  const txs = state.transactions.filter(t => inMonth(t.date, year, month, payDay));
  let actualVariable = 0;
  let actualFixed = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (!isShared(t)) continue;
    if (isFixedExpense(t, fixedCats)) actualFixed += t.amount;
    else actualVariable += t.amount;
  }

  const plannedLoans = state.loans.reduce((s, l) => s + l.monthlyPayment + (l.monthlyFee ?? 0), 0);
  const plannedSavings = state.goals.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0);
  const plannedFreeToSpend = Math.max(0, plannedIncome - plannedFixed - plannedLoans - plannedSavings);
  const remaining = plannedFreeToSpend - actualVariable;
  const spendPercent = plannedFreeToSpend > 0 ? actualVariable / plannedFreeToSpend : 0;

  return {
    plannedIncome,
    plannedFixed,
    plannedLoans,
    plannedSavings,
    plannedFreeToSpend,
    actualVariable,
    actualFixed,
    remaining,
    spendPercent,
    hasRecurring: state.recurringTransactions.some(r => r.isActive && isShared(r)),
  };
}

// ─── Kvar att spendera — appens enda sanning ─────────────────────────────────
// Alla vyer som visar "kvar att spendera" ska använda denna funktion så att
// talet betyder samma sak överallt.
//
// Två lägen:
//  - "plan":   det finns en månadsplan (återkommande poster, lån eller månads-
//              sparande) → kvar = planerat fritt utrymme − rörliga utgifter hittills.
//  - "actual": ingen plan → kvar = inkomst − utgifter. Saknas inkomst-
//              transaktioner används personernas registrerade månadslöner.

export interface RemainingToSpend {
  value: number;
  model: "plan" | "actual";
  plan: MonthPlan;
  /** true när inga inkomsttransaktioner finns och registrerade löner används istället */
  expectedIncomeUsed: boolean;
  /** effektiv inkomst (faktisk, eller förväntad när expectedIncomeUsed) */
  income: number;
  /** faktiska delade utgifter under perioden */
  expenses: number;
}

export function calcRemainingToSpend(state: AppState, year: number, month: number): RemainingToSpend {
  const plan = buildMonthPlan(state, year, month);
  const usePlan = plan.hasRecurring || plan.plannedLoans > 0 || plan.plannedSavings > 0;
  const summary = summarizeMonth(state, year, month);
  const totalPersonIncome = state.persons.reduce((s, p) => s + p.income, 0);
  const expectedIncomeUsed = summary.income === 0 && totalPersonIncome > 0;
  const income = expectedIncomeUsed ? totalPersonIncome : summary.income;
  return {
    value: usePlan ? plan.remaining : income - summary.expenses,
    model: usePlan ? "plan" : "actual",
    plan,
    expectedIncomeUsed,
    income,
    expenses: summary.expenses,
  };
}

// Kontrollerar om ett ISO-datum tillhör den givna perioden.
// payDay = 1 (standard): kalendermånad (1:a → sista)
// payDay > 1: löneperiod — "månad M" = payDay i månad M-1 t.o.m. payDay-1 i månad M.
// Exempel: payDay=25, månad=maj (month=4) → 25 apr – 24 maj.
export const inMonth = (iso: string, year: number, month: number, payDay = 1): boolean => {
  const [y, m, d] = iso.split("-").map(Number);
  if (payDay <= 1) {
    // Kalendermånad — parsar direkt för att undvika UTC-midnatt-skift.
    return y === year && m - 1 === month;
  }
  // Löneperiod: from = föregående månad dag payDay, to = denna månad dag payDay-1
  const txDate = new Date(y, m - 1, d);
  const start = new Date(year, month - 1, payDay);
  const end = new Date(year, month, payDay - 1);
  return txDate >= start && txDate <= end;
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

// Kategorier markerade som isFixed i inställningarna.
function buildFixedCatIds(state: AppState): Set<string> {
  return new Set<string>(state.categories.filter(c => c.isFixed).map(c => c.id));
}

// En transaktion är "fast" om:
//  1. dess kategori är markerad isFixed, ELLER
//  2. den är auto-genererad från en återkommande mall (isRecurring: true)
// Inte hela kategorin — annars klassas t.ex. matinköp i "Mat & Hushåll" som fasta
// bara för att Billån råkar ligga i samma kategori.
export const isFixedExpense = (t: { categoryId?: string; isRecurring?: boolean }, fixedCats: Set<string>) =>
  fixedCats.has(t.categoryId ?? "") || !!t.isRecurring;

export function summarizeMonth(state: AppState, year: number, month: number): MonthSummary {
  const payDay = state.settings.payDay ?? 1;
  const fixedCats = buildFixedCatIds(state);
  const txs = state.transactions.filter(t => inMonth(t.date, year, month, payDay));
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
    if (t.type !== "expense") continue;
    if (isShared(t)) {
      if (isFixedExpense(t, fixedCats)) fixed += t.amount;
      else variable += t.amount;
      if (t.categoryId) {
        byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      }
      byPerson[t.payerId] = (byPerson[t.payerId] || 0) + t.amount;
    } else {
      if (isFixedExpense(t, fixedCats)) personalFixed += t.amount;
      else personalVariable += t.amount;
      if (t.categoryId) {
        personalByCategory[t.categoryId] = (personalByCategory[t.categoryId] || 0) + t.amount;
      }
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
  const now = new Date();
  const recentMonthKeys = new Set([
    monthKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  ]);

  const groups: Record<string, Transaction[]> = {};
  for (const t of state.transactions) {
    if (t.type !== "expense") continue;
    const key = `${t.description.trim().toLowerCase()}__${Math.round(t.amount)}`;
    (groups[key] ||= []).push(t);
  }
  const subs: Subscription[] = [];
  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue;
    const months = new Set(txs.map(t => monthKey(t.date)));
    if (months.size < 2) continue;
    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    const override = state.subscriptionOverrides[key];
    // Nollställ "cancelled"-override om transaktioner dykt upp igen nyligen
    const hasRecentTx = txs.some(t => recentMonthKeys.has(monthKey(t.date)));
    const effectiveStatus = override === "cancelled" && hasRecentTx ? "active" : (override ?? "active");
    subs.push({
      id: key,
      description: txs[0].description,
      amount: Math.round(txs[0].amount),
      categoryId: txs[0].categoryId ?? "",
      occurrences: months.size,
      lastDate: sorted[0].date,
      status: effectiveStatus,
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

// Transaktioner med giltig anpassad fördelning (splitShares) delas enligt sina
// egna procentandelar istället för hushållets standardregler.
const hasCustomSplit = (t: { splitShares?: Record<string, number> }): boolean => {
  if (!t.splitShares) return false;
  let sum = 0;
  for (const v of Object.values(t.splitShares)) sum += v;
  return sum > 0;
};

// Fördelar en transaktions belopp enligt dess splitShares (normaliserar om
// andelarna inte summerar till exakt 100).
function allocateCustom(
  txs: { amount: number; splitShares?: Record<string, number> }[],
  persons: AppState["persons"],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of persons) out[p.id] = 0;
  for (const t of txs) {
    const shares = t.splitShares!;
    const sum = Object.values(shares).reduce((s, v) => s + v, 0);
    if (sum <= 0) continue;
    for (const p of persons) {
      out[p.id] += t.amount * ((shares[p.id] ?? 0) / sum);
    }
  }
  return out;
}

function buildSettlements(diff: Record<string, number>, persons: AppState["persons"]): Settlement[] {
  const creditors = persons
    .map(p => ({ id: p.id, amount: diff[p.id] ?? 0 }))
    .filter(x => x.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);
  const debtors = persons
    .map(p => ({ id: p.id, amount: -(diff[p.id] ?? 0) }))
    .filter(x => x.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amount, debtors[di].amount);
    if (pay > 0.5) settlements.push({ from: debtors[di].id, to: creditors[ci].id, amount: pay });
    creditors[ci].amount -= pay;
    debtors[di].amount -= pay;
    if (creditors[ci].amount < 0.5) ci++;
    if (debtors[di].amount < 0.5) di++;
  }
  return settlements;
}

export function calcCumulativeSplit(state: AppState) {
  const fixedCats = buildFixedCatIds(state);
  const txs = state.transactions.filter(t => t.type === "expense" && isShared(t));
  const persons = state.persons;

  if (persons.length === 0) return { diff: {} as Record<string, number>, settlements: [] as Settlement[] };

  // Transaktioner med anpassad fördelning hanteras separat från standardreglerna.
  const customTxs = txs.filter(hasCustomSplit);
  const standardTxs = txs.filter(t => !hasCustomSplit(t));

  const fixedTotal = standardTxs.filter(t => isFixedExpense(t, fixedCats)).reduce((s, t) => s + t.amount, 0);
  const variableTotal = standardTxs.filter(t => !isFixedExpense(t, fixedCats)).reduce((s, t) => s + t.amount, 0);
  const standardTotal = fixedTotal + variableTotal;

  const paid: Record<string, number> = {};
  for (const p of persons) paid[p.id] = 0;
  for (const t of txs) {
    if (paid[t.payerId] !== undefined) paid[t.payerId] += t.amount;
  }

  // Fasta: inkomstbaserat eller lika. Rörliga: alltid lika. Anpassade: enligt splitShares.
  const equalVariable = variableTotal / persons.length;
  const customShare = allocateCustom(customTxs, persons);
  const share: Record<string, number> = {};
  if (state.settings.splitMode === "50/50") {
    for (const p of persons) share[p.id] = standardTotal / persons.length + customShare[p.id];
  } else {
    const totalIncome = persons.reduce((s, p) => s + p.income, 0) || 1;
    for (const p of persons) {
      share[p.id] = fixedTotal * (p.income / totalIncome) + equalVariable + customShare[p.id];
    }
  }

  const diff: Record<string, number> = {};
  for (const p of persons) diff[p.id] = (paid[p.id] ?? 0) - share[p.id];

  const personIds = new Set(persons.map(p => p.id));
  for (const s of state.transactions.filter(t => t.type === "settlement")) {
    if (s.payerId && s.receiverId && personIds.has(s.payerId) && personIds.has(s.receiverId)) {
      diff[s.payerId] += s.amount;
      diff[s.receiverId] -= s.amount;
    }
  }

  return { diff, settlements: buildSettlements(diff, persons) };
}

export function calcSplit(state: AppState, year: number, month: number) {
  const payDay = state.settings.payDay ?? 1;
  const fixedCats = buildFixedCatIds(state);
  // Privata transaktioner exkluderas helt från delningen — de berör endast ägaren.
  const txs = state.transactions.filter(t => t.type === "expense" && isShared(t) && inMonth(t.date, year, month, payDay));
  const persons = state.persons;

  // Transaktioner med anpassad fördelning delas enligt sina egna andelar.
  const customTxs = txs.filter(hasCustomSplit);
  const standardTxs = txs.filter(t => !hasCustomSplit(t));

  const fixedTxs = standardTxs.filter(t => isFixedExpense(t, fixedCats));
  const variableTxs = standardTxs.filter(t => !isFixedExpense(t, fixedCats));

  const fixedTotal = fixedTxs.reduce((s, t) => s + t.amount, 0);
  const variableTotal = variableTxs.reduce((s, t) => s + t.amount, 0);
  const customTotal = customTxs.reduce((s, t) => s + t.amount, 0);
  const total = fixedTotal + variableTotal + customTotal;

  const paid: Record<string, number> = {};
  for (const p of persons) paid[p.id] = 0;
  for (const t of txs) {
    if (paid[t.payerId] !== undefined) paid[t.payerId] += t.amount;
  }

  const fixedShare: Record<string, number> = {};
  const variableShare: Record<string, number> = {};
  const customShare: Record<string, number> = {};
  const share: Record<string, number> = {};

  if (persons.length === 0) {
    return { total, fixedTotal, variableTotal, customTotal, paid, fixedShare, variableShare, customShare, share, diff: {}, settlements: [] as Settlement[] };
  }

  // Fasta: delas enligt valt läge (lika eller inkomstbaserat)
  // Rörliga: delas alltid lika (50/50) — dagligvaror och vardagsutgifter ska inte viktas mot lön
  // Anpassade: delas enligt transaktionens splitShares
  const equalVariable = variableTotal / persons.length;
  if (state.settings.splitMode === "50/50") {
    const equalFixed = fixedTotal / persons.length;
    for (const p of persons) { fixedShare[p.id] = equalFixed; variableShare[p.id] = equalVariable; }
  } else {
    const totalIncome = persons.reduce((s, p) => s + p.income, 0) || 1;
    for (const p of persons) {
      fixedShare[p.id] = fixedTotal * (p.income / totalIncome);
      variableShare[p.id] = equalVariable;
    }
  }

  const allocated = allocateCustom(customTxs, persons);
  for (const p of persons) {
    customShare[p.id] = allocated[p.id];
    share[p.id] = fixedShare[p.id] + variableShare[p.id] + customShare[p.id];
  }

  // Diff: positive = ligger ute med pengar (har betalat mer än sin andel)
  const diff: Record<string, number> = {};
  for (const p of persons) diff[p.id] = (paid[p.id] ?? 0) - share[p.id];

  // Applicera settlement-betalningar från denna månad — de påverkar differensen
  const settlementsThisMonth = state.transactions.filter(t => t.type === "settlement" && inMonth(t.date, year, month, payDay));
  for (const settlement of settlementsThisMonth) {
    if (settlement.payerId && settlement.receiverId) {
      // Betalaren får "kredit" för att ha betalat
      diff[settlement.payerId] = (diff[settlement.payerId] ?? 0) + settlement.amount;
      // Mottagaren får mindre kredit
      diff[settlement.receiverId] = (diff[settlement.receiverId] ?? 0) - settlement.amount;
    }
  }

  return { total, fixedTotal, variableTotal, customTotal, paid, fixedShare, variableShare, customShare, share, diff, settlements: buildSettlements(diff, persons) };
}

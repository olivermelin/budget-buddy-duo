import { AppState, Loan } from "@/types/budget";
import { lastNMonths, summarizeMonth, detectSubscriptions, computeEffectiveBudgets, currentPeriodMonth } from "./analytics";
import { sek, pct } from "./format";

// ─── Ekonomisk hälsa — källförankrad regelmotor ──────────────────────────────
//
// Ren funktion utan bieffekter. Räknar en hälsoscore (0–100) + konkreta
// åtgärdsförslag utifrån etablerade riktmärken. AI-lagret (edge function)
// formulerar bara texten — det här är enda källan till siffror och poäng.
//
// Riktmärken:
//  - 50/30/20-regeln (Elizabeth Warren): ~50 % nödvändigt, ~30 % rörligt, ≥20 % sparande
//  - Buffert 3–6 månadsutgifter (Konsumentverket / Gilla Din Ekonomi)
//  - Betalningskvot för lån (Finansinspektionen)
//  - Avalanche-metoden: betala av högsta räntan först

export type HealthStatus = "good" | "warn" | "bad";
export type HealthArea = "savings" | "fixed" | "debt" | "variable";

export interface HealthScenario {
  label: string;
  detail: string;
  impact?: number;   // ungefärlig effekt kr/mån (för sortering/visning)
  // Förifyllning av amorteringssimulatorn när användaren klickar på förslaget.
  sim?: { loanId: string; extra?: number; lump?: number };
}

export interface HealthFinding {
  id: string;
  area: HealthArea;
  status: HealthStatus;
  title: string;
  detail: string;
  current: number;   // andel (0–1) eller belopp beroende på finding
  target: number;
  source: string;
  action?: string;
  impact?: number;   // kr/mån potentiell effekt — sorteringsnyckel
  scenarios?: HealthScenario[]; // konkreta åtgärdsförslag med beräknade tal
}

export interface AreaScore {
  area: HealthArea;
  label: string;
  score: number; // 0–100
  weight: number;
}

export interface FinancialHealth {
  score: number; // 0–100, viktad totalpoäng
  grade: "Utmärkt" | "Bra" | "Okej" | "Behöver åtgärd";
  areas: AreaScore[];
  findings: HealthFinding[];
  basis: {
    income: number;
    fixed: number;
    variable: number;
    savings: number;
    savingsRate: number;
    debtService: number;
    monthsAveraged: number;
  };
}

const WEIGHTS: Record<HealthArea, number> = { savings: 30, fixed: 25, debt: 25, variable: 20 };
const AREA_LABELS: Record<HealthArea, string> = {
  savings: "Sparkvot",
  fixed: "Fasta utgifter",
  debt: "Skuldbörda",
  variable: "Rörliga utgifter",
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// Poäng för "högre är bättre": når target → 100.
const targetScore = (value: number, target: number) =>
  clamp((value / target) * 100);

// Poäng för "lägre är bättre": <= goodAt → 100, >= badAt → 0, linjärt mellan.
const lowerBetterScore = (value: number, goodAt: number, badAt: number) => {
  if (value <= goodAt) return 100;
  if (value >= badAt) return 0;
  return clamp(100 - ((value - goodAt) / (badAt - goodAt)) * 100);
};

const gradeFor = (score: number): FinancialHealth["grade"] =>
  score >= 80 ? "Utmärkt" : score >= 60 ? "Bra" : score >= 40 ? "Okej" : "Behöver åtgärd";

const HIGH_INTEREST_TYPES = new Set(["credit_card", "personal"]);

// Amorteringssimulering med fast amortering (rak amortering) — appens lånemodell.
// Räntan ackumuleras på saldot varje månad och betalas vid sidan av amorteringen;
// saldot minskar med `monthlyPrincipal` tills det är avbetalt. Annuitetslån betalas
// av något snabbare, så detta är en medvetet försiktig uppskattning. Capas vid 100 år
// så ett lån utan amortering inte loopar oändligt.
export function simulatePayoff(
  balance: number,
  annualRatePct: number,
  monthlyPrincipal: number,
): { months: number; totalInterest: number } {
  if (monthlyPrincipal <= 0) return { months: Infinity, totalInterest: Infinity };
  const monthlyRate = annualRatePct / 100 / 12;
  const CAP = 1200; // 100 år
  let bal = balance;
  let totalInterest = 0;
  let months = 0;
  while (bal > 0 && months < CAP) {
    totalInterest += bal * monthlyRate;
    bal -= monthlyPrincipal;
    months++;
  }
  return { months, totalInterest };
}

const round500 = (n: number) => Math.round(n / 500) * 500;
const round1000 = (n: number) => Math.round(n / 1000) * 1000;

// Konkreta, beräknade åtgärdsförslag för en hög skuldbörda. Alla tal kommer härifrån —
// AI-lagret får bara formulera dem. Förslagen förankras i det dyraste lånet och anpassas
// till hushållets faktiska överskott så att de aldrig förutsätter att man lever på noll.
function buildDebtScenarios(
  loans: Loan[],
  income: number,
  expenses: number,
  debtMonthly: number,
  totalSaved: number,
): HealthScenario[] {
  const scenarios: HealthScenario[] = [];
  const withBalance = loans.filter(l => l.currentBalance > 0);
  if (withBalance.length === 0) return scenarios;

  // Dyraste lånet: högst ränta, vid lika störst saldo.
  const worst = [...withBalance].sort(
    (a, b) => b.interestRate - a.interestRate || b.currentBalance - a.currentBalance,
  )[0];
  const base = simulatePayoff(worst.currentBalance, worst.interestRate, worst.monthlyAmortization);

  // Överskott efter nuvarande lånekostnader — konservativt, hellre för lågt än för högt.
  const freeCashFlow = Math.max(0, income - expenses - debtMonthly);

  // ── Amortera mer ── (bara med reellt månadsöverskott och en amortering att höja)
  // Förslaget är en blygsam startpunkt: en femtedel av överskottet, så att det mesta av
  // pengarna finns kvar att leva och spara för. Användaren finjusterar sen i simulatorn.
  const extra = round500(freeCashFlow * 0.2);
  if (freeCashFlow >= 300 && extra >= 500 && worst.monthlyAmortization > 0 && isFinite(base.months)) {
    const faster = simulatePayoff(worst.currentBalance, worst.interestRate, worst.monthlyAmortization + extra);
    const monthsSaved = base.months - faster.months;
    const interestSaved = base.totalInterest - faster.totalInterest;
    if (monthsSaved > 0) {
      scenarios.push({
        label: "Amortera mer",
        detail: `Lägg ${sek(extra)}/mån extra på ${worst.name}: skuldfri ${monthsSaved} mån tidigare och spara ${sek(interestSaved)} i ränta totalt.`,
        impact: interestSaved / base.months,
        sim: { loanId: worst.id, extra },
      });
    }
  }

  // ── Engångsinsättning ── (från bufferten utöver 3 mån, annars ett bonus-skalat exempel)
  const excessBuffer = Math.max(0, totalSaved - expenses * 3);
  const lump = excessBuffer >= 5000 ? round1000(excessBuffer) : round1000(income);
  const lumpSource = excessBuffer >= 5000
    ? "pengar i bufferten utöver tre månadsutgifter"
    : "t.ex. en bonus eller skatteåterbäring";
  if (lump >= 1000 && worst.monthlyAmortization > 0 && isFinite(base.months)) {
    const after = simulatePayoff(Math.max(0, worst.currentBalance - lump), worst.interestRate, worst.monthlyAmortization);
    const monthsSaved = base.months - after.months;
    const interestSaved = base.totalInterest - after.totalInterest;
    if (monthsSaved > 0) {
      scenarios.push({
        label: "Engångsinsättning",
        detail: `En engångsinsättning på ${sek(lump)} på ${worst.name} (${lumpSource}) kortar löptiden ${monthsSaved} mån och sparar ${sek(interestSaved)} i ränta.`,
        impact: interestSaved / base.months,
        sim: { loanId: worst.id, lump },
      });
    }
  }

  // ── Sänk skuldkvoten ── den ärliga spaken för själva kvoten: minska månadskostnaden.
  const gap = debtMonthly - income * 0.20;
  if (gap > 0) {
    const smallest = [...withBalance].sort(
      (a, b) => (a.monthlyPayment + (a.monthlyFee ?? 0)) - (b.monthlyPayment + (b.monthlyFee ?? 0)),
    )[0];
    const smallestCost = smallest.monthlyPayment + (smallest.monthlyFee ?? 0);
    scenarios.push({
      label: "Sänk skuldkvoten",
      detail: `Lånekostnaderna ligger ${sek(gap)}/mån över riktmärket på 20 %. Att lösa eller refinansiera ${smallest.name} (${sek(smallestCost)}/mån) tar er närmare det.`,
      impact: gap,
    });
  }

  return scenarios;
}

export function computeFinancialHealth(state: AppState, ref: Date = new Date()): FinancialHealth {
  // Lönedagsmedvetet ankare: efter lönedagen tillhör "nu" den nya löneperioden, så
  // 3-månadersfönstret och innevarande-månad-kontrollen ska utgå från den — annars
  // missas all aktuell aktivitet och hälsan blir felaktigt rosenröd.
  const anchor = currentPeriodMonth(state.settings.payDay ?? 1, ref);
  const window = lastNMonths(state, 3, anchor);
  // Dela bara på månader med faktisk aktivitet så att en enstaka aktiv månad inte
  // späds ut över tre (vanligt för nya hushåll).
  const activeMonths = window.filter(m => m.income > 0 || m.expenses > 0).length || 1;
  const avg = (sel: (m: typeof window[number]) => number) =>
    window.reduce((s, m) => s + sel(m), 0) / activeMonths;

  const registeredIncome = state.persons.reduce((s, p) => s + p.income, 0);
  // Registrerad månadslön är det stabilaste måttet på inkomstnivå; faller tillbaka
  // på faktiska inkomsttransaktioner när löner inte fyllts i.
  const income = registeredIncome > 0 ? registeredIncome : avg(m => m.income);
  const fixed = avg(m => m.fixed);
  const variable = avg(m => m.variable);
  const expenses = fixed + variable;
  const savings = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? savings / income : 0;

  const debtMonthly = state.loans.reduce((s, l) => s + l.monthlyPayment + (l.monthlyFee ?? 0), 0);
  const debtService = income > 0 ? debtMonthly / income : 0;

  const basis = {
    income, fixed, variable, savings, savingsRate, debtService,
    monthsAveraged: activeMonths,
  };

  // Utan inkomstunderlag går inga rättvisa kvoter att räkna.
  if (income <= 0) {
    return {
      score: 0,
      grade: "Behöver åtgärd",
      areas: (Object.keys(WEIGHTS) as HealthArea[]).map(a => ({
        area: a, label: AREA_LABELS[a], score: 0, weight: WEIGHTS[a],
      })),
      findings: [{
        id: "no-income", area: "savings", status: "warn",
        title: "Lägg till er inkomst",
        detail: "Fyll i era månadsinkomster (eller registrera löneinkomster) så kan vi bedöma er ekonomi.",
        current: 0, target: 0, source: "Budget Buddy",
      }],
      basis,
    };
  }

  const findings: HealthFinding[] = [];

  // ─── Sparkvot ────────────────────────────────────────────────────────────
  const savingsScore = targetScore(savingsRate, 0.20);
  {
    const status: HealthStatus = savingsRate >= 0.20 ? "good" : savingsRate >= 0.10 ? "warn" : "bad";
    const targetAmount = income * 0.20;
    const gap = Math.max(0, targetAmount - savings);
    findings.push({
      id: "savings-rate", area: "savings", status,
      title: status === "good" ? "Stark sparkvot" : status === "warn" ? "Sparkvoten kan höjas" : "Låg sparkvot",
      detail: `Ni sparar ${pct(savingsRate)} av inkomsten. Riktmärket är minst 20 %.`,
      current: savingsRate, target: 0.20, source: "50/30/20-regeln",
      action: gap > 0 ? `Öka sparandet med ${sek(gap)}/mån för att nå 20 %.` : undefined,
      impact: gap,
    });
  }

  // Buffert (sekundär finding under sparkvot)
  if (expenses > 0) {
    const totalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
    const bufferMonths = totalSaved / expenses;
    // Bufferten är en mjuk knuff: nått 3 månader → bra, annars en varning (aldrig "bad").
    const status: HealthStatus = bufferMonths >= 3 ? "good" : "warn";
    findings.push({
      id: "buffer", area: "savings", status,
      title: status === "good" ? "Trygg buffert" : "Liten buffert",
      detail: `Er buffert räcker ca ${bufferMonths.toFixed(1)} månader. Riktmärket är 3–6 månadsutgifter (${sek(expenses * 3)}–${sek(expenses * 6)}).`,
      current: bufferMonths, target: 3, source: "Konsumentverket",
      action: status !== "good" ? `Bygg upp bufferten till minst ${sek(expenses * 3)}.` : undefined,
      impact: Math.max(0, expenses * 3 - totalSaved) / 12,
    });
  }

  // ─── Fasta utgifter ──────────────────────────────────────────────────────
  const fixedRatio = fixed / income;
  const fixedScore = lowerBetterScore(fixedRatio, 0.50, 0.65);
  {
    const status: HealthStatus = fixedRatio <= 0.50 ? "good" : fixedRatio <= 0.65 ? "warn" : "bad";
    findings.push({
      id: "fixed-ratio", area: "fixed", status,
      title: status === "good" ? "Fasta utgifter i balans" : "Höga fasta utgifter",
      detail: `Fasta utgifter är ${pct(fixedRatio)} av inkomsten. 50/30/20-regeln siktar på ca 50 %.`,
      current: fixedRatio, target: 0.50, source: "50/30/20-regeln",
      action: status !== "good" ? "Se över boende, försäkringar och abonnemang — det är här störst fasta besparingar brukar finnas." : undefined,
      impact: Math.max(0, fixed - income * 0.50),
    });
  }

  // Abonnemang (fasta-området)
  const activeSubs = detectSubscriptions(state).filter(s => s.status === "active");
  if (activeSubs.length > 0) {
    const totalSubs = activeSubs.reduce((s, sub) => s + sub.amount, 0);
    const top = activeSubs[0]; // detectSubscriptions sorterar fallande efter belopp
    const heavy = totalSubs > income * 0.05;
    findings.push({
      id: "subscriptions", area: "fixed", status: heavy ? "warn" : "good",
      title: `${activeSubs.length} aktiva abonnemang`,
      detail: `Era abonnemang kostar ${sek(totalSubs)}/mån tillsammans${heavy ? " — det är mer än 5 % av inkomsten" : ""}.`,
      current: totalSubs, target: income * 0.05, source: "Budget Buddy",
      action: `Störst är ${top.description} (${sek(top.amount)}/mån) — säg upp det du inte använder.`,
      impact: totalSubs,
    });
  }

  // ─── Skuldbörda ──────────────────────────────────────────────────────────
  const debtScore = lowerBetterScore(debtService, 0.20, 0.45);
  if (debtMonthly > 0) {
    const status: HealthStatus = debtService <= 0.20 ? "good" : debtService <= 0.35 ? "warn" : "bad";
    const totalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
    // Bara när skuldbördan faktiskt är hög lägger vi på konkreta förbättringsförslag.
    const scenarios = status === "good"
      ? undefined
      : buildDebtScenarios(state.loans, income, expenses, debtMonthly, totalSaved);
    findings.push({
      id: "debt-service", area: "debt", status,
      title: status === "good" ? "Hanterbar skuldbörda" : "Hög skuldbörda",
      detail: `Lånekostnaderna är ${pct(debtService)} av inkomsten (${sek(debtMonthly)}/mån).`,
      current: debtService, target: 0.20, source: "Finansinspektionen",
      impact: Math.max(0, debtMonthly - income * 0.20),
      scenarios: scenarios && scenarios.length > 0 ? scenarios : undefined,
    });
  }

  // Högräntelån — prioritera enligt avalanche-metoden
  const highInterest = state.loans
    .filter(l => l.currentBalance > 0 && l.interestRate >= 8 && HIGH_INTEREST_TYPES.has(l.type))
    .sort((a, b) => b.interestRate - a.interestRate);
  if (highInterest.length > 0) {
    const worst = highInterest[0];
    const yearlyInterest = highInterest.reduce((s, l) => s + l.currentBalance * (l.interestRate / 100), 0);
    findings.push({
      id: "high-interest-debt", area: "debt", status: "bad",
      title: "Dyra lån att prioritera",
      detail: `${highInterest.length} lån med hög ränta kostar ca ${sek(yearlyInterest)}/år i ränta.`,
      current: worst.interestRate / 100, target: 0.08, source: "Avalanche-metoden",
      action: `Betala av ${worst.name} (${pct(worst.interestRate / 100)} ränta) först — avalanche-metoden sparar mest räntekronor.`,
      impact: yearlyInterest / 12,
    });
  }

  // ─── Rörliga utgifter ────────────────────────────────────────────────────
  const variableRatio = variable / income;
  const variableScore = lowerBetterScore(variableRatio, 0.30, 0.45);
  {
    const status: HealthStatus = variableRatio <= 0.30 ? "good" : variableRatio <= 0.45 ? "warn" : "bad";
    findings.push({
      id: "variable-ratio", area: "variable", status,
      title: status === "good" ? "Rörliga utgifter i balans" : "Höga rörliga utgifter",
      detail: `Rörliga utgifter är ${pct(variableRatio)} av inkomsten. 50/30/20-regeln siktar på ca 30 %.`,
      current: variableRatio, target: 0.30, source: "50/30/20-regeln",
      action: status !== "good" ? "Sätt en månadsbudget för mat, nöje och shopping." : undefined,
      impact: Math.max(0, variable - income * 0.30),
    });
  }

  // Kategori över budget (innevarande månad)
  const budgets = computeEffectiveBudgets(state);
  const curMonth = summarizeMonth(state, anchor.getFullYear(), anchor.getMonth());
  const overspent = state.categories
    .filter(c => !c.isIncome)
    .map(c => ({ c, spent: curMonth.byCategory[c.id] ?? 0, budget: budgets[c.id] ?? 0 }))
    .filter(x => x.budget > 0 && x.spent > x.budget)
    .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));
  if (overspent.length > 0) {
    const worst = overspent[0];
    findings.push({
      id: "category-over-budget", area: "variable", status: "warn",
      title: "Kategori över budget",
      detail: `${worst.c.name} har dragit ${sek(worst.spent)} av ${sek(worst.budget)} i budget denna månad.`,
      current: worst.spent, target: worst.budget, source: "Er budget",
      action: `Dra ner på ${worst.c.name} resten av månaden.`,
      impact: worst.spent - worst.budget,
    });
  }

  // ─── Sammanvägning ─────────────────────────────────────────────────────────
  const areas: AreaScore[] = [
    { area: "savings", label: AREA_LABELS.savings, score: Math.round(savingsScore), weight: WEIGHTS.savings },
    { area: "fixed", label: AREA_LABELS.fixed, score: Math.round(fixedScore), weight: WEIGHTS.fixed },
    { area: "debt", label: AREA_LABELS.debt, score: Math.round(debtScore), weight: WEIGHTS.debt },
    { area: "variable", label: AREA_LABELS.variable, score: Math.round(variableScore), weight: WEIGHTS.variable },
  ];
  const score = Math.round(
    areas.reduce((s, a) => s + a.score * a.weight, 0) / 100
  );

  const statusRank: Record<HealthStatus, number> = { bad: 0, warn: 1, good: 2 };
  findings.sort((a, b) =>
    statusRank[a.status] - statusRank[b.status] || (b.impact ?? 0) - (a.impact ?? 0)
  );

  return { score, grade: gradeFor(score), areas, findings, basis };
}

import { describe, it, expect } from "vitest";
import { computeFinancialHealth, simulatePayoff } from "@/lib/financial-health";
import { AppState, Transaction, Category, Person, Loan, SavingsGoal } from "@/types/budget";

// ─── Factories ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
    persons: [],
    categories: [],
    transactions: [],
    goals: [],
    loans: [],
    subscriptionOverrides: {},
    recurringTransactions: [],
    importRules: [],
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    date: "2026-03-15",
    amount: 500,
    type: "expense",
    categoryId: "var-1",
    payerId: "p-1",
    description: "Testutgift",
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "var-1",
    name: "Mat",
    icon: "🍔",
    color: "158 64% 42%",
    budget: 5000,
    isFixed: false,
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return { id: "p-1", name: "Anna", color: "#94a3b8", income: 30000, ...overrides };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: `l-${Math.random().toString(36).slice(2, 8)}`,
    name: "Lån", type: "personal", lender: "", originalAmount: 100000,
    currentBalance: 50000, interestRate: 5, monthlyPayment: 2000,
    monthlyAmortization: 1000, monthlyFee: 0, ownerShare: 50, icon: "🏦", payments: [],
    ...overrides,
  };
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    name: "Buffert", icon: "💰", target: 100000, saved: 0,
    contributions: [], snapshots: [], ...overrides,
  };
}

const REF = new Date(2026, 2, 15); // mars 2026 → lastNMonths täcker jan/feb/mar
const area = (r: ReturnType<typeof computeFinancialHealth>, a: string) =>
  r.areas.find(x => x.area === a)!;
const finding = (r: ReturnType<typeof computeFinancialHealth>, id: string) =>
  r.findings.find(f => f.id === id);

// ─── Sparkvot ─────────────────────────────────────────────────────────────────

describe("computeFinancialHealth — sparkvot", () => {
  it("ger maxpoäng och good-finding när hushållet sparar 30 %", () => {
    const state = makeState({
      persons: [makePerson({ income: 50000 })],
      categories: [makeCategory({ id: "fixed-1", isFixed: true }), makeCategory({ id: "var-1" })],
      transactions: [
        makeTx({ date: "2026-03-05", amount: 20000, categoryId: "fixed-1" }),
        makeTx({ date: "2026-03-10", amount: 15000, categoryId: "var-1" }),
      ],
    });
    const r = computeFinancialHealth(state, REF);
    expect(r.basis.savingsRate).toBeCloseTo(0.30, 2);
    expect(area(r, "savings").score).toBe(100);
    expect(finding(r, "savings-rate")!.status).toBe("good");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.grade).toBe("Utmärkt");
  });

  it("ger 0 poäng och bad-finding när utgifterna överstiger inkomsten", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "fixed-1", isFixed: true }), makeCategory({ id: "var-1" })],
      transactions: [
        makeTx({ date: "2026-03-05", amount: 15000, categoryId: "fixed-1" }),
        makeTx({ date: "2026-03-10", amount: 20000, categoryId: "var-1" }),
      ],
    });
    const r = computeFinancialHealth(state, REF);
    expect(r.basis.savingsRate).toBe(0);
    expect(area(r, "savings").score).toBe(0);
    expect(finding(r, "savings-rate")!.status).toBe("bad");
    expect(r.score).toBeLessThanOrEqual(60);
  });

  it("föreslår ett konkret belopp för att nå 20 % sparmål", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 36000, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    // sparar 4000 (10 %), mål 20 % = 8000 → behöver +4000/mån
    const f = finding(r, "savings-rate")!;
    expect(f.target).toBeCloseTo(0.20, 2);
    expect(f.action).toContain("4");
  });
});

// ─── Buffert ────────────────────────────────────────────────────────────────

describe("computeFinancialHealth — buffert", () => {
  it("varnar när bufferten är mindre än tre månadsutgifter", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 20000, categoryId: "var-1" })],
      goals: [makeGoal({ saved: 10000 })], // 0,5 mån av 20000 i utgifter
    });
    const r = computeFinancialHealth(state, REF);
    expect(finding(r, "buffer")!.status).toBe("warn");
  });

  it("ger good-finding när bufferten räcker minst tre månader", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 20000, categoryId: "var-1" })],
      goals: [makeGoal({ saved: 80000 })], // 4 mån av 20000
    });
    const r = computeFinancialHealth(state, REF);
    expect(finding(r, "buffer")!.status).toBe("good");
  });
});

// ─── Fasta utgifter & abonnemang ──────────────────────────────────────────────

describe("computeFinancialHealth — fasta utgifter", () => {
  it("flaggar när fasta utgifter överstiger ~65 % av inkomsten", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "fixed-1", isFixed: true })],
      transactions: [makeTx({ date: "2026-03-05", amount: 21000, categoryId: "fixed-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    expect(r.basis.fixed).toBe(21000);
    expect(finding(r, "fixed-ratio")!.status).toBe("bad");
    expect(area(r, "fixed").score).toBeLessThan(40);
  });
});

describe("computeFinancialHealth — abonnemang", () => {
  it("skapar en abonnemangs-finding som pekar ut dyraste prenumerationen", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-15", categoryId: "var-1" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-02-15", categoryId: "var-1" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-03-15", categoryId: "var-1" }),
      ],
    });
    const r = computeFinancialHealth(state, REF);
    const f = finding(r, "subscriptions")!;
    expect(f.impact).toBeGreaterThan(0);
    expect(f.action).toContain("Netflix");
  });

  it("skapar ingen abonnemangs-finding när inga prenumerationer hittas", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 500, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    expect(finding(r, "subscriptions")).toBeUndefined();
  });
});

// ─── Lån & skuldbörda ─────────────────────────────────────────────────────────

describe("computeFinancialHealth — skuldbörda", () => {
  it("pekar ut högräntelån att prioritera enligt avalanche-metoden", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      loans: [
        makeLoan({ name: "Kreditkort", type: "credit_card", interestRate: 18, currentBalance: 25000, monthlyPayment: 1500 }),
        makeLoan({ name: "Bolån", type: "mortgage", interestRate: 3, currentBalance: 2000000, monthlyPayment: 6000 }),
      ],
    });
    const r = computeFinancialHealth(state, REF);
    const f = finding(r, "high-interest-debt")!;
    expect(f.status).not.toBe("good");
    expect(f.action!.toLowerCase()).toContain("avalanche");
    expect(f.action).toContain("Kreditkort");
  });

  it("räknar betalningskvoten på alla lånekostnader", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      loans: [makeLoan({ monthlyPayment: 8000, monthlyFee: 0, type: "mortgage", interestRate: 3 })],
    });
    const r = computeFinancialHealth(state, REF);
    expect(r.basis.debtService).toBeCloseTo(0.20, 2);
  });
});

// ─── Rörliga utgifter & kategorier ────────────────────────────────────────────

describe("computeFinancialHealth — rörliga utgifter", () => {
  it("flaggar när rörliga utgifter ligger långt över 30 %", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 18000, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    expect(finding(r, "variable-ratio")!.status).toBe("bad");
  });

  it("flaggar kategori som överskrider sin budget", () => {
    const state = makeState({
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1", name: "Nöje", budget: 2000 })],
      transactions: [makeTx({ date: "2026-03-10", amount: 3500, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    const f = finding(r, "category-over-budget")!;
    expect(f.action).toContain("Nöje");
  });
});

// ─── Score, grade & robusthet ─────────────────────────────────────────────────

describe("computeFinancialHealth — totalpoäng & robusthet", () => {
  it("ger en hög totalpoäng för en sund ekonomi", () => {
    const state = makeState({
      persons: [makePerson({ income: 50000 })],
      categories: [makeCategory({ id: "fixed-1", isFixed: true }), makeCategory({ id: "var-1" })],
      transactions: [
        makeTx({ date: "2026-03-05", amount: 18000, categoryId: "fixed-1" }), // 36 %
        makeTx({ date: "2026-03-10", amount: 14000, categoryId: "var-1" }),   // 28 %
      ],
      goals: [makeGoal({ saved: 120000 })],
    });
    const r = computeFinancialHealth(state, REF);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(["Utmärkt", "Bra"]).toContain(r.grade);
  });

  it("väger ihop delpoängen till fyra områden", () => {
    const r = computeFinancialHealth(makeState({ persons: [makePerson({ income: 40000 })] }), REF);
    expect(r.areas.map(a => a.area).sort()).toEqual(["debt", "fixed", "savings", "variable"]);
    expect(r.areas.reduce((s, a) => s + a.weight, 0)).toBe(100);
  });

  it("kraschar inte på tomt state och flaggar att inkomst saknas", () => {
    const r = computeFinancialHealth(makeState(), REF);
    expect(typeof r.score).toBe("number");
    expect(finding(r, "no-income")).toBeDefined();
    expect(r.score).toBe(0);
  });

  it("räknar på aktuell löneperiod efter lönedagen (payDay-medvetet)", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 25 },
      persons: [makePerson({ income: 40000 })],
      categories: [makeCategory({ id: "var-1" })],
      // 26 juni ligger i perioden 25 jun–24 jul. Med rå "idag" (juni) hamnade den
      // utanför fönstret och utgiften försvann; ankaret ska fånga den.
      transactions: [makeTx({ date: "2026-06-26", amount: 8000, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, new Date(2026, 5, 26));
    expect(r.basis.variable).toBe(8000);
  });

  it("sorterar findings med allvarligaste (bad) först", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "var-1" })],
      transactions: [makeTx({ date: "2026-03-10", amount: 25000, categoryId: "var-1" })],
    });
    const r = computeFinancialHealth(state, REF);
    const firstBad = r.findings.findIndex(f => f.status === "bad");
    const firstGood = r.findings.findIndex(f => f.status === "good");
    if (firstBad !== -1 && firstGood !== -1) {
      expect(firstBad).toBeLessThan(firstGood);
    }
  });
});

// ─── Amorteringssimulering ────────────────────────────────────────────────────

describe("simulatePayoff", () => {
  it("räknar löptiden för ett räntefritt lån som saldo/amortering", () => {
    const r = simulatePayoff(12000, 0, 1000);
    expect(r.months).toBe(12);
    expect(r.totalInterest).toBe(0);
  });

  it("returnerar Infinity när amorteringen är noll (skulden betas aldrig av)", () => {
    const r = simulatePayoff(50000, 5, 0);
    expect(r.months).toBe(Infinity);
  });

  it("ger kortare löptid och lägre total ränta vid högre amortering", () => {
    const base = simulatePayoff(100000, 6, 1000);
    const faster = simulatePayoff(100000, 6, 2000);
    expect(faster.months).toBeLessThan(base.months);
    expect(faster.totalInterest).toBeLessThan(base.totalInterest);
    expect(base.totalInterest).toBeGreaterThan(0);
  });

  it("tar med ränta på saldot — sista månaden överamorterar inte", () => {
    // 10000 / 2500 = 4 hela amorteringar, ränta tillkommer men löptiden ska vara 4 mån.
    const r = simulatePayoff(10000, 12, 2500);
    expect(r.months).toBe(4);
  });
});

// ─── Skuldbörda — konkreta åtgärdsförslag ─────────────────────────────────────

describe("computeFinancialHealth — åtgärdsförslag för skuldbörda", () => {
  // Hög skuldbörda + tydligt månadsöverskott → alla tre scenarier ska finnas.
  const heavyDebtState = () => makeState({
    persons: [makePerson({ income: 40000 })],
    categories: [makeCategory({ id: "var-1" })],
    transactions: [makeTx({ date: "2026-03-10", amount: 4000, categoryId: "var-1" })],
    loans: [
      makeLoan({ name: "Privatlån", type: "personal", interestRate: 9, currentBalance: 120000, monthlyPayment: 13000, monthlyAmortization: 10000, monthlyFee: 0 }),
      makeLoan({ name: "Billån", type: "car", interestRate: 4, currentBalance: 40000, monthlyPayment: 3000, monthlyAmortization: 2000, monthlyFee: 0 }),
    ],
  });

  it("ger debt-service-fyndet konkreta scenarier när skuldbördan är hög", () => {
    const f = finding(computeFinancialHealth(heavyDebtState(), REF), "debt-service")!;
    expect(f.status).toBe("bad");
    expect(f.scenarios && f.scenarios.length).toBeGreaterThanOrEqual(2);
  });

  it("föreslår extra amortering anpassad till överskottet, med positiv effekt", () => {
    const f = finding(computeFinancialHealth(heavyDebtState(), REF), "debt-service")!;
    const extra = f.scenarios!.find(s => s.label === "Amortera mer")!;
    expect(extra).toBeDefined();
    // Sparar räntekronor och förkortar löptiden → positiv effekt.
    expect(extra.impact).toBeGreaterThan(0);
  });

  it("inkluderar ett sänk-skuldkvoten-scenario som pekar ut den ärliga spaken", () => {
    const f = finding(computeFinancialHealth(heavyDebtState(), REF), "debt-service")!;
    const ratio = f.scenarios!.find(s => s.label === "Sänk skuldkvoten")!;
    expect(ratio).toBeDefined();
    expect(ratio.detail).toContain("20");
  });

  it("håller den föreslagna extraamorteringen rimlig — långt under hela överskottet", () => {
    const state = heavyDebtState();
    // Överskott efter lånekostnader: 40000 − 4000 rörligt − 16000 lån = 20000.
    const f = finding(computeFinancialHealth(state, REF), "debt-service")!;
    const extra = f.scenarios!.find(s => s.label === "Amortera mer")!;
    // Får aldrig sluka hela överskottet — högst ~en tredjedel.
    expect(extra.sim!.extra!).toBeLessThanOrEqual(20000 / 3);
    expect(extra.sim!.extra!).toBeGreaterThan(0);
  });

  it("länkar amortera-mer till simulatorn med rätt lån och förifyllt extrabelopp", () => {
    const state = heavyDebtState();
    const worst = state.loans.find(l => l.name === "Privatlån")!; // högst ränta
    const f = finding(computeFinancialHealth(state, REF), "debt-service")!;
    const extra = f.scenarios!.find(s => s.label === "Amortera mer")!;
    expect(extra.sim!.loanId).toBe(worst.id);
    expect(extra.sim!.extra).toBeGreaterThan(0);
  });

  it("länkar engångsinsättning till simulatorns engångsfält", () => {
    const state = heavyDebtState();
    const worst = state.loans.find(l => l.name === "Privatlån")!;
    const f = finding(computeFinancialHealth(state, REF), "debt-service")!;
    const lump = f.scenarios!.find(s => s.label === "Engångsinsättning")!;
    expect(lump.sim!.loanId).toBe(worst.id);
    expect(lump.sim!.lump).toBeGreaterThan(0);
  });

  it("utelämnar extra-amortering-scenariot när hushållet saknar månadsöverskott", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "var-1" })],
      // Rörliga utgifter äter upp allt som blir kvar efter lånekostnaderna.
      transactions: [makeTx({ date: "2026-03-10", amount: 21000, categoryId: "var-1" })],
      loans: [makeLoan({ name: "Privatlån", type: "personal", interestRate: 9, currentBalance: 120000, monthlyPayment: 9000, monthlyAmortization: 7000, monthlyFee: 0 })],
    });
    const f = finding(computeFinancialHealth(state, REF), "debt-service")!;
    const extra = f.scenarios?.find(s => s.label === "Amortera mer");
    expect(extra).toBeUndefined();
  });

  it("ger inga skuld-scenarier när hushållet saknar lån", () => {
    const state = makeState({ persons: [makePerson({ income: 40000 })] });
    expect(finding(computeFinancialHealth(state, REF), "debt-service")).toBeUndefined();
  });
});

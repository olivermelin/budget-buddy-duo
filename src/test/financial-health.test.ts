import { describe, it, expect } from "vitest";
import { computeFinancialHealth } from "@/lib/financial-health";
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

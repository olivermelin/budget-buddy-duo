import { describe, it, expect } from "vitest";
import { inMonth, summarizeMonth, lastNMonths, detectSubscriptions, calcSplit, calcCumulativeSplit, calcRemainingToSpend } from "@/lib/analytics";
import { AppState, Transaction, Category, Person, RecurringTransaction } from "@/types/budget";

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
    categoryId: "cat-1",
    payerId: "p-1",
    description: "Testutgift",
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Mat",
    icon: "utensils",
    color: "158 64% 42%",
    budget: 5000,
    isFixed: false,
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p-1",
    name: "Anna",
    color: "#94a3b8",
    income: 30000,
    ...overrides,
  };
}

// ─── inMonth ────────────────────────────────────────────────────────────────

describe("inMonth", () => {
  it("returnerar true för datum i angiven månad", () => {
    // month = 0 (januari)
    expect(inMonth("2026-01-15", 2026, 0)).toBe(true);
  });

  it("returnerar false för datum i annan månad", () => {
    expect(inMonth("2026-02-15", 2026, 0)).toBe(false);
  });

  it("returnerar false för rätt månad men fel år", () => {
    expect(inMonth("2025-01-15", 2026, 0)).toBe(false);
  });

  it("hanterar december korrekt (month = 11)", () => {
    expect(inMonth("2026-12-31", 2026, 11)).toBe(true);
  });

  it("hanterar första dagen i månaden", () => {
    expect(inMonth("2026-05-01", 2026, 4)).toBe(true);
  });
});

// ─── summarizeMonth ─────────────────────────────────────────────────────────

describe("summarizeMonth", () => {
  it("summerar inkomster och utgifter separat", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1", isFixed: false })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 50000, type: "income" }),
        makeTx({ date: "2026-03-15", amount: 3000, type: "expense", categoryId: "cat-1" }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2); // mars = month 2
    expect(summary.income).toBe(50000);
    expect(summary.expenses).toBe(3000);
    expect(summary.remaining).toBe(47000);
  });

  it("skiljer på fasta och rörliga utgifter", () => {
    const state = makeState({
      categories: [
        makeCategory({ id: "fixed-1", isFixed: true }),
        makeCategory({ id: "var-1", isFixed: false }),
      ],
      transactions: [
        makeTx({ date: "2026-03-01", amount: 8000, type: "expense", categoryId: "fixed-1" }),
        makeTx({ date: "2026-03-10", amount: 2000, type: "expense", categoryId: "var-1" }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2);
    expect(summary.fixed).toBe(8000);
    expect(summary.variable).toBe(2000);
    expect(summary.expenses).toBe(10000);
  });

  it("bygger byCategory med summerade belopp", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1" }), makeCategory({ id: "cat-2" })],
      transactions: [
        makeTx({ date: "2026-03-05", amount: 300, type: "expense", categoryId: "cat-1" }),
        makeTx({ date: "2026-03-15", amount: 200, type: "expense", categoryId: "cat-1" }),
        makeTx({ date: "2026-03-20", amount: 100, type: "expense", categoryId: "cat-2" }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2);
    expect(summary.byCategory["cat-1"]).toBe(500);
    expect(summary.byCategory["cat-2"]).toBe(100);
  });

  it("bygger byPerson med summerade belopp", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-05", amount: 400, type: "expense", payerId: "p-1" }),
        makeTx({ date: "2026-03-10", amount: 600, type: "expense", payerId: "p-2" }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2);
    expect(summary.byPerson["p-1"]).toBe(400);
    expect(summary.byPerson["p-2"]).toBe(600);
  });

  it("returnerar noll för månad utan transaktioner", () => {
    const state = makeState();
    const summary = summarizeMonth(state, 2026, 5);
    expect(summary.income).toBe(0);
    expect(summary.expenses).toBe(0);
    expect(summary.remaining).toBe(0);
    expect(summary.savings).toBe(0);
  });

  it("sätter savings till 0 om utgifter överstiger inkomst", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 10000, type: "income" }),
        makeTx({ date: "2026-03-15", amount: 15000, type: "expense", categoryId: "cat-1" }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2);
    expect(summary.savings).toBe(0);
    expect(summary.remaining).toBe(-5000);
  });
});

// ─── lastNMonths ────────────────────────────────────────────────────────────

describe("lastNMonths", () => {
  it("returnerar rätt antal månader", () => {
    const state = makeState();
    const result = lastNMonths(state, 3, new Date(2026, 2, 15)); // mars 2026
    expect(result).toHaveLength(3);
  });

  it("returnerar månader i kronologisk ordning", () => {
    const state = makeState();
    const result = lastNMonths(state, 3, new Date(2026, 2, 15));
    expect(result[0].month).toBe(0); // januari
    expect(result[1].month).toBe(1); // februari
    expect(result[2].month).toBe(2); // mars
  });
});

// ─── detectSubscriptions ────────────────────────────────────────────────────

describe("detectSubscriptions", () => {
  it("returnerar tom lista om inga transaktioner finns", () => {
    const state = makeState();
    expect(detectSubscriptions(state)).toEqual([]);
  });

  it("hittar inte prenumeration med bara en förekomst", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-15" }),
      ],
    });
    expect(detectSubscriptions(state)).toEqual([]);
  });

  it("hittar inte prenumeration med flera förekomster i samma månad", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-10" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-20" }),
      ],
    });
    expect(detectSubscriptions(state)).toEqual([]);
  });

  it("hittar prenumeration med 2+ förekomster i olika månader", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-15" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-02-15" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-03-15" }),
      ],
    });
    const subs = detectSubscriptions(state);
    expect(subs).toHaveLength(1);
    expect(subs[0].description).toBe("Netflix");
    expect(subs[0].amount).toBe(149);
    expect(subs[0].occurrences).toBe(3);
  });

  it("normaliserar beskrivning (case-insensitive, trim)", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "  Netflix ", amount: 149, date: "2026-01-15" }),
        makeTx({ description: "netflix", amount: 149, date: "2026-02-15" }),
      ],
    });
    const subs = detectSubscriptions(state);
    expect(subs).toHaveLength(1);
  });

  it("applicerar subscriptionOverrides på status", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Spotify", amount: 119, date: "2026-01-15" }),
        makeTx({ description: "Spotify", amount: 119, date: "2026-02-15" }),
      ],
      subscriptionOverrides: { "spotify__119": "cancelled" },
    });
    const subs = detectSubscriptions(state);
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe("cancelled");
  });

  it("ignorerar inkomsttransaktioner", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Lön", amount: 30000, type: "income", date: "2026-01-25" }),
        makeTx({ description: "Lön", amount: 30000, type: "income", date: "2026-02-25" }),
      ],
    });
    expect(detectSubscriptions(state)).toEqual([]);
  });

  it("sorterar prenumerationer fallande efter belopp", () => {
    const state = makeState({
      transactions: [
        makeTx({ description: "Netflix", amount: 149, date: "2026-01-15" }),
        makeTx({ description: "Netflix", amount: 149, date: "2026-02-15" }),
        makeTx({ description: "Gym", amount: 399, date: "2026-01-10" }),
        makeTx({ description: "Gym", amount: 399, date: "2026-02-10" }),
      ],
    });
    const subs = detectSubscriptions(state);
    expect(subs).toHaveLength(2);
    expect(subs[0].description).toBe("Gym");
    expect(subs[1].description).toBe("Netflix");
  });
});

// ─── calcSplit ──────────────────────────────────────────────────────────────

describe("calcSplit", () => {
  it("beräknar 50/50-fördelning korrekt", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
      persons: [makePerson({ id: "p-1" }), makePerson({ id: "p-2" })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 1000, type: "expense", payerId: "p-1" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.total).toBe(1000);
    expect(result.share["p-1"]).toBe(500);
    expect(result.share["p-2"]).toBe(500);
  });

  it("beräknar settlement i 50/50-läge", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
      persons: [makePerson({ id: "p-1" }), makePerson({ id: "p-2" })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 1000, type: "expense", payerId: "p-1" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    // p-1 betalade 1000, andel 500 => diff +500
    // p-2 betalade 0, andel 500 => diff -500
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].from).toBe("p-2");
    expect(result.settlements[0].to).toBe("p-1");
    expect(result.settlements[0].amount).toBe(500);
  });

  it("beräknar inkomstbaserad fördelning för fasta utgifter", () => {
    // Fasta utgifter delas inkomstbaserat; rörliga alltid 50/50.
    // Här testas enbart fasta (isFixed: true) för att verifiera income-split.
    const state = makeState({
      settings: { householdName: "Test", splitMode: "income", theme: "system" },
      persons: [
        makePerson({ id: "p-1", income: 30000 }),
        makePerson({ id: "p-2", income: 10000 }),
      ],
      categories: [makeCategory({ id: "cat-1", isFixed: true })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 4000, type: "expense", payerId: "p-1", categoryId: "cat-1" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.total).toBe(4000);
    // p-1 tjänar 75% => fixedShare = 3000, p-2 tjänar 25% => fixedShare = 1000
    expect(result.fixedShare["p-1"]).toBe(3000);
    expect(result.fixedShare["p-2"]).toBe(1000);
    expect(result.share["p-1"]).toBe(3000);
    expect(result.share["p-2"]).toBe(1000);
  });

  it("delar alltid rörliga utgifter 50/50 oavsett split-läge", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "income", theme: "system" },
      persons: [
        makePerson({ id: "p-1", income: 30000 }),
        makePerson({ id: "p-2", income: 10000 }),
      ],
      categories: [makeCategory({ id: "cat-1", isFixed: false })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 4000, type: "expense", payerId: "p-1", categoryId: "cat-1" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    // Rörliga är alltid 50/50 oavsett inkomstfördelning
    expect(result.variableShare["p-1"]).toBe(2000);
    expect(result.variableShare["p-2"]).toBe(2000);
  });

  it("hanterar tomt persons-array utan krasch", () => {
    const state = makeState({
      transactions: [makeTx({ date: "2026-03-10" })],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.total).toBe(500);
    expect(result.settlements).toEqual([]);
  });

  it("filtrerar bort inkomster och transaktioner utanför månaden", () => {
    const state = makeState({
      persons: [makePerson({ id: "p-1" })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 500, type: "expense" }),
        makeTx({ date: "2026-03-15", amount: 50000, type: "income" }),
        makeTx({ date: "2026-04-10", amount: 9999, type: "expense" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.total).toBe(500);
  });

  it("skapar ingen settlement om båda betalar exakt sin andel", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
      persons: [makePerson({ id: "p-1" }), makePerson({ id: "p-2" })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 500, type: "expense", payerId: "p-1" }),
        makeTx({ date: "2026-03-15", amount: 500, type: "expense", payerId: "p-2" }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.settlements).toEqual([]);
  });

  it("exkluderar privata utgifter helt från delningen", () => {
    const state = makeState({
      settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
      persons: [makePerson({ id: "p-1" }), makePerson({ id: "p-2" })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 1000, type: "expense", payerId: "p-1" }),
        // p-1 har dessutom en privat utgift på 5000 — får inte påverka split
        makeTx({ date: "2026-03-12", amount: 5000, type: "expense", payerId: "p-1", isPrivate: true }),
      ],
    });
    const result = calcSplit(state, 2026, 2);
    expect(result.total).toBe(1000);            // privata räknas inte med
    expect(result.variableTotal).toBe(1000);
    expect(result.paid["p-1"]).toBe(1000);      // betalningen för den privata raden räknas inte
    expect(result.share["p-1"]).toBe(500);
    expect(result.share["p-2"]).toBe(500);
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].amount).toBe(500); // bara halva 1000 — inget extra från privata
  });
});

describe("calcSplit — anpassad fördelning (splitShares)", () => {
  const baseState = () => makeState({
    settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
    persons: [makePerson({ id: "p-1" }), makePerson({ id: "p-2", name: "Berit" })],
    categories: [makeCategory({ id: "cat-1", isFixed: false })],
  });

  it("delar en transaktion enligt sina egna andelar (70/30)", () => {
    const state = baseState();
    state.transactions = [
      makeTx({ date: "2026-03-10", amount: 1000, payerId: "p-1", splitShares: { "p-1": 70, "p-2": 30 } }),
    ];
    const result = calcSplit(state, 2026, 2);
    expect(result.customTotal).toBe(1000);
    expect(result.variableTotal).toBe(0);
    expect(result.share["p-1"]).toBe(700);
    expect(result.share["p-2"]).toBe(300);
    // p-1 betalade 1000 men ska bara stå för 700 → p-2 är skyldig 300
    expect(result.diff["p-1"]).toBe(300);
    expect(result.settlements).toEqual([{ from: "p-2", to: "p-1", amount: 300 }]);
  });

  it("normaliserar andelar som inte summerar till 100", () => {
    const state = baseState();
    state.transactions = [
      makeTx({ date: "2026-03-10", amount: 1000, payerId: "p-1", splitShares: { "p-1": 1, "p-2": 1 } }),
    ];
    const result = calcSplit(state, 2026, 2);
    expect(result.customShare["p-1"]).toBe(500);
    expect(result.customShare["p-2"]).toBe(500);
  });

  it("behandlar tomma andelar som standardfördelning", () => {
    const state = baseState();
    state.transactions = [
      makeTx({ date: "2026-03-10", amount: 1000, payerId: "p-1", splitShares: {} }),
    ];
    const result = calcSplit(state, 2026, 2);
    expect(result.customTotal).toBe(0);
    expect(result.variableTotal).toBe(1000);
    expect(result.share["p-1"]).toBe(500);
  });

  it("respekterar anpassade andelar även i kumulativ split", () => {
    const state = baseState();
    state.transactions = [
      makeTx({ date: "2026-03-10", amount: 1000, payerId: "p-2", splitShares: { "p-1": 30, "p-2": 70 } }),
    ];
    const result = calcCumulativeSplit(state);
    expect(result.diff["p-2"]).toBe(300);
    expect(result.settlements).toEqual([{ from: "p-1", to: "p-2", amount: 300 }]);
  });
});

describe("calcRemainingToSpend", () => {
  const makeRecurring = (overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
    id: `rt-${Math.random().toString(36).slice(2, 8)}`,
    description: "Hyra",
    amount: 10000,
    type: "expense",
    categoryId: "cat-1",
    payerId: "p-1",
    dayOfMonth: 25,
    isActive: true,
    lastGeneratedMonth: null,
    ...overrides,
  });

  it("använder actual-modellen när ingen månadsplan finns", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 50000, type: "income" }),
        makeTx({ date: "2026-03-15", amount: 3000, type: "expense" }),
      ],
    });
    const rem = calcRemainingToSpend(state, 2026, 2);
    expect(rem.model).toBe("actual");
    expect(rem.value).toBe(47000);
    expect(rem.expectedIncomeUsed).toBe(false);
  });

  it("faller tillbaka på registrerade löner när inkomsttransaktioner saknas", () => {
    const state = makeState({
      persons: [makePerson({ income: 30000 })],
      categories: [makeCategory({ id: "cat-1" })],
      transactions: [makeTx({ date: "2026-03-15", amount: 2000, type: "expense" })],
    });
    const rem = calcRemainingToSpend(state, 2026, 2);
    expect(rem.model).toBe("actual");
    expect(rem.expectedIncomeUsed).toBe(true);
    expect(rem.income).toBe(30000);
    expect(rem.value).toBe(28000);
  });

  it("använder planmodellen när återkommande poster finns", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1", isFixed: false })],
      recurringTransactions: [
        makeRecurring({ type: "income", amount: 40000 }),
        makeRecurring({ type: "expense", amount: 10000 }),
      ],
      transactions: [makeTx({ date: "2026-03-15", amount: 5000, type: "expense" })],
    });
    const rem = calcRemainingToSpend(state, 2026, 2);
    expect(rem.model).toBe("plan");
    // planerat fritt = 40000 − 10000 = 30000; rörligt spenderat = 5000
    expect(rem.value).toBe(25000);
  });

  it("räknar lånkostnader som plan även utan återkommande poster", () => {
    const state = makeState({
      categories: [makeCategory({ id: "cat-1" })],
      loans: [{
        id: "l-1", name: "Bolån", type: "mortgage", lender: "", originalAmount: 2000000,
        currentBalance: 1800000, interestRate: 3.5, monthlyPayment: 8000,
        monthlyAmortization: 3000, monthlyFee: 0, ownerShare: 50, icon: "🏠", payments: [],
      }],
    });
    const rem = calcRemainingToSpend(state, 2026, 2);
    expect(rem.model).toBe("plan");
  });
});

describe("summarizeMonth — privata utgifter", () => {
  it("räknar privata utgifter i `personal` men inte i delade totaler", () => {
    const state = makeState({
      persons: [makePerson({ id: "p-1" })],
      categories: [makeCategory({ id: "cat-1", isFixed: false })],
      transactions: [
        makeTx({ date: "2026-03-10", amount: 800, type: "expense", payerId: "p-1" }),
        makeTx({ date: "2026-03-12", amount: 300, type: "expense", payerId: "p-1", isPrivate: true }),
      ],
    });
    const summary = summarizeMonth(state, 2026, 2);
    expect(summary.variable).toBe(800);
    expect(summary.expenses).toBe(800);
    expect(summary.personal.variable).toBe(300);
    expect(summary.personal.expenses).toBe(300);
    expect(summary.personal.byCategory["cat-1"]).toBe(300);
  });
});

import { describe, it, expect, vi } from "vitest";
import { reducer, Action } from "@/store/reducer";
import { AppState, Transaction, Category, Person, SavingsGoal } from "@/types/budget";

// ─── Factories ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    settings: { householdName: "Testfamiljen", splitMode: "50/50", theme: "system", payDay: 1 },
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
    id: "tx-1",
    date: "2026-01-15",
    amount: 500,
    type: "expense",
    categoryId: "cat-1",
    payerId: "p-1",
    description: "Testköp",
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

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "goal-1",
    name: "Semester",
    icon: "plane",
    target: 20000,
    saved: 5000,
    contributions: [],
    snapshots: [],
    ...overrides,
  };
}

// ─── Tester ─────────────────────────────────────────────────────────────────

describe("Budget reducer", () => {
  // --- ADD_TX ---

  describe("ADD_TX", () => {
    it("lägger till en transaktion med angivet id", () => {
      const state = makeState();
      const tx = makeTx({ id: "custom-id" });
      const result = reducer(state, { type: "ADD_TX", tx });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe("custom-id");
      expect(result.transactions[0].amount).toBe(500);
    });

    it("genererar ett id om inget anges", () => {
      const state = makeState();
      const { id, ...txWithoutId } = makeTx();
      const result = reducer(state, { type: "ADD_TX", tx: txWithoutId });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBeDefined();
      expect(result.transactions[0].id).not.toBe("");
    });

    it("lägger nya transaktioner först i listan", () => {
      const state = makeState({ transactions: [makeTx({ id: "old" })] });
      const result = reducer(state, { type: "ADD_TX", tx: makeTx({ id: "new" }) });
      expect(result.transactions[0].id).toBe("new");
      expect(result.transactions[1].id).toBe("old");
    });
  });

  // --- UPDATE_TX ---

  describe("UPDATE_TX", () => {
    it("uppdaterar en befintlig transaktion med patch", () => {
      const state = makeState({ transactions: [makeTx({ id: "tx-1", amount: 500 })] });
      const result = reducer(state, { type: "UPDATE_TX", id: "tx-1", patch: { amount: 999 } });
      expect(result.transactions[0].amount).toBe(999);
      expect(result.transactions[0].description).toBe("Testköp"); // oförändrad
    });

    it("lämnar andra transaktioner orörda", () => {
      const state = makeState({
        transactions: [makeTx({ id: "tx-1" }), makeTx({ id: "tx-2", amount: 200 })],
      });
      const result = reducer(state, { type: "UPDATE_TX", id: "tx-1", patch: { amount: 999 } });
      expect(result.transactions[1].amount).toBe(200);
    });
  });

  // --- DELETE_TX ---

  describe("DELETE_TX", () => {
    it("tar bort transaktion med givet id", () => {
      const state = makeState({ transactions: [makeTx({ id: "tx-1" }), makeTx({ id: "tx-2" })] });
      const result = reducer(state, { type: "DELETE_TX", id: "tx-1" });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe("tx-2");
    });
  });

  // --- UPSERT_CATEGORY ---

  describe("UPSERT_CATEGORY", () => {
    it("skapar ny kategori om den inte finns", () => {
      const state = makeState();
      const cat = makeCategory({ id: "cat-new" });
      const result = reducer(state, { type: "UPSERT_CATEGORY", cat });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].id).toBe("cat-new");
    });

    it("uppdaterar befintlig kategori med samma id", () => {
      const state = makeState({ categories: [makeCategory({ id: "cat-1", name: "Mat" })] });
      const result = reducer(state, {
        type: "UPSERT_CATEGORY",
        cat: makeCategory({ id: "cat-1", name: "Livsmedel" }),
      });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe("Livsmedel");
    });
  });

  // --- DELETE_CATEGORY ---

  describe("DELETE_CATEGORY", () => {
    it("tar bort kategori med givet id", () => {
      const state = makeState({
        categories: [makeCategory({ id: "cat-1" }), makeCategory({ id: "cat-2" })],
      });
      const result = reducer(state, { type: "DELETE_CATEGORY", id: "cat-1" });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].id).toBe("cat-2");
    });
  });

  // --- UPDATE_PERSON ---

  describe("UPDATE_PERSON", () => {
    it("uppdaterar en persons namn via patch", () => {
      const state = makeState({ persons: [makePerson({ id: "p-1", name: "Anna" })] });
      const result = reducer(state, { type: "UPDATE_PERSON", id: "p-1", patch: { name: "Bertil" } });
      expect(result.persons[0].name).toBe("Bertil");
      expect(result.persons[0].income).toBe(30000); // oförändrad
    });
  });

  // --- UPSERT_GOAL ---

  describe("UPSERT_GOAL", () => {
    it("skapar nytt sparmål om det inte finns", () => {
      const state = makeState();
      const goal = makeGoal({ id: "g-new" });
      const result = reducer(state, { type: "UPSERT_GOAL", goal });
      expect(result.goals).toHaveLength(1);
      expect(result.goals[0].name).toBe("Semester");
    });

    it("uppdaterar befintligt sparmål med samma id", () => {
      const state = makeState({ goals: [makeGoal({ id: "goal-1", saved: 5000 })] });
      const result = reducer(state, {
        type: "UPSERT_GOAL",
        goal: makeGoal({ id: "goal-1", saved: 10000 }),
      });
      expect(result.goals).toHaveLength(1);
      expect(result.goals[0].saved).toBe(10000);
    });
  });

  // --- DELETE_GOAL ---

  describe("DELETE_GOAL", () => {
    it("tar bort sparmål med givet id", () => {
      const state = makeState({ goals: [makeGoal({ id: "goal-1" }), makeGoal({ id: "goal-2" })] });
      const result = reducer(state, { type: "DELETE_GOAL", goalId: "goal-1" });
      expect(result.goals).toHaveLength(1);
      expect(result.goals[0].id).toBe("goal-2");
    });
  });

  // --- ADD_GOAL_CONTRIB ---

  describe("ADD_GOAL_CONTRIB", () => {
    it("ökar saved och lägger till ett bidrag", () => {
      const state = makeState({ goals: [makeGoal({ id: "goal-1", saved: 5000, contributions: [] })] });
      const result = reducer(state, { type: "ADD_GOAL_CONTRIB", goalId: "goal-1", amount: 1000, personId: "p-1" });
      expect(result.goals[0].saved).toBe(6000);
      expect(result.goals[0].contributions).toHaveLength(1);
      expect(result.goals[0].contributions[0].amount).toBe(1000);
      expect(result.goals[0].contributions[0].personId).toBe("p-1");
    });
  });

  // --- ADD_GOAL_SNAPSHOT ---

  describe("ADD_GOAL_SNAPSHOT", () => {
    it("sätter saved till balance och lägger till en snapshot", () => {
      const state = makeState({ goals: [makeGoal({ id: "goal-1", saved: 5000, snapshots: [] })] });
      const result = reducer(state, {
        type: "ADD_GOAL_SNAPSHOT",
        goalId: "goal-1",
        balance: 7500,
        date: "2026-03-01",
        note: "Kontrollerat saldo",
      });
      expect(result.goals[0].saved).toBe(7500);
      expect(result.goals[0].snapshots).toHaveLength(1);
      expect(result.goals[0].snapshots[0].balance).toBe(7500);
      expect(result.goals[0].snapshots[0].note).toBe("Kontrollerat saldo");
    });
  });

  // --- DELETE_GOAL_SNAPSHOT ---

  describe("DELETE_GOAL_SNAPSHOT", () => {
    it("tar bort en snapshot från ett sparmål", () => {
      const state = makeState({
        goals: [makeGoal({
          id: "goal-1",
          snapshots: [
            { id: "snap-1", date: "2026-01-01", balance: 3000, note: "A" },
            { id: "snap-2", date: "2026-02-01", balance: 5000, note: "B" },
          ],
        })],
      });
      const result = reducer(state, { type: "DELETE_GOAL_SNAPSHOT", goalId: "goal-1", snapshotId: "snap-1" });
      expect(result.goals[0].snapshots).toHaveLength(1);
      expect(result.goals[0].snapshots[0].id).toBe("snap-2");
    });
  });

  // --- UPDATE_SETTINGS ---

  describe("UPDATE_SETTINGS", () => {
    it("mergar settings med patch", () => {
      const state = makeState();
      const result = reducer(state, { type: "UPDATE_SETTINGS", patch: { householdName: "Ny familj", splitMode: "income" } });
      expect(result.settings.householdName).toBe("Ny familj");
      expect(result.settings.splitMode).toBe("income");
      expect(result.settings.theme).toBe("system"); // oförändrad
    });
  });

  // --- SET_SUB_STATUS ---

  describe("SET_SUB_STATUS", () => {
    it("sätter prenumerationsstatus för en nyckel", () => {
      const state = makeState();
      const result = reducer(state, { type: "SET_SUB_STATUS", key: "netflix__149", status: "cancelled" });
      expect(result.subscriptionOverrides["netflix__149"]).toBe("cancelled");
    });

    it("kan ändra från cancelled till active", () => {
      const state = makeState({ subscriptionOverrides: { "sub-1": "cancelled" } });
      const result = reducer(state, { type: "SET_SUB_STATUS", key: "sub-1", status: "active" });
      expect(result.subscriptionOverrides["sub-1"]).toBe("active");
    });
  });

  // --- RESET / CLEAR ---

  describe("RESET och CLEAR", () => {
    it("nollställer transactions, goals och subscriptionOverrides vid RESET", () => {
      const state = makeState({
        transactions: [makeTx()],
        goals: [makeGoal()],
        subscriptionOverrides: { key: "active" },
        categories: [makeCategory()],
      });
      const result = reducer(state, { type: "RESET" });
      expect(result.transactions).toEqual([]);
      expect(result.goals).toEqual([]);
      expect(result.subscriptionOverrides).toEqual({});
      // categories och settings bevaras
      expect(result.categories).toHaveLength(1);
      expect(result.settings.householdName).toBe("Testfamiljen");
    });

    it("nollställer samma fält vid CLEAR", () => {
      const state = makeState({
        transactions: [makeTx()],
        goals: [makeGoal()],
        subscriptionOverrides: { key: "active" },
      });
      const result = reducer(state, { type: "CLEAR" });
      expect(result.transactions).toEqual([]);
      expect(result.goals).toEqual([]);
      expect(result.subscriptionOverrides).toEqual({});
    });
  });

  // --- HYDRATE ---

  describe("HYDRATE", () => {
    it("ersätter hela state med den angivna", () => {
      const state = makeState({ transactions: [makeTx()] });
      const newState = makeState({
        settings: { householdName: "Ny familj", splitMode: "income", theme: "dark" },
        persons: [makePerson()],
      });
      const result = reducer(state, { type: "HYDRATE", state: newState });
      expect(result).toEqual(newState);
      expect(result.transactions).toEqual([]);
      expect(result.settings.householdName).toBe("Ny familj");
    });
  });

  // --- Unknown action ---

  describe("okänd action", () => {
    it("returnerar state oförändrad", () => {
      const state = makeState({ transactions: [makeTx()] });
      // @ts-expect-error — testar okänd action-typ
      const result = reducer(state, { type: "UNKNOWN_ACTION" });
      expect(result).toBe(state);
    });
  });
});

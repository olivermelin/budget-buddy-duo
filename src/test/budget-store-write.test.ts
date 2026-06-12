import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToSupabase } from "@/store/budget-store";
import type { AppState, RecurringTransaction } from "@/types/budget";

// Kedjbar Supabase-mock: alla builder-metoder returnerar buildern, await ger `response`.
const supa = vi.hoisted(() => {
  const state = {
    calls: [] as { table: string; method: string; args: unknown[] }[],
    response: { error: null } as { error: { message: string } | null },
  };
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(state.response).then(onFulfilled, onRejected);
      },
    };
    for (const method of ["select", "insert", "update", "upsert", "delete", "eq", "order", "single"]) {
      builder[method] = (...args: unknown[]) => {
        state.calls.push({ table, method, args });
        return builder;
      };
    }
    return builder;
  };
  return { state, makeBuilder };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => supa.makeBuilder(table),
    rpc: (...args: unknown[]) => {
      supa.state.calls.push({ table: "<rpc>", method: "rpc", args });
      return supa.makeBuilder("<rpc>");
    },
  },
}));

vi.mock("@/lib/sentry", () => ({ Sentry: { captureException: vi.fn() } }));

const baseState: AppState = {
  settings: { householdName: "Test", splitMode: "50/50", theme: "system", payDay: 1 },
  persons: [],
  categories: [],
  transactions: [],
  goals: [],
  loans: [],
  subscriptionOverrides: {},
  recurringTransactions: [],
  importRules: [],
};

const makeRecurring = (patch: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: "r1",
  description: "Hyra",
  amount: 9000,
  type: "expense",
  categoryId: "cat-1",
  payerId: "user-1",
  dayOfMonth: 25,
  isActive: true,
  lastGeneratedMonth: null,
  skippedMonths: [],
  ...patch,
});

const updatePayloads = () =>
  supa.state.calls.filter(c => c.method === "update").map(c => c.args[0]);

describe("writeToSupabase", () => {
  beforeEach(() => {
    supa.state.calls.length = 0;
    supa.state.response = { error: null };
  });

  it("skriver nya skipped_months vid TOGGLE_RECURRING_SKIP (skip på)", async () => {
    const preState: AppState = {
      ...baseState,
      recurringTransactions: [makeRecurring({ skippedMonths: ["2026-05"] })],
    };

    await writeToSupabase(
      { type: "TOGGLE_RECURRING_SKIP", id: "r1", monthKey: "2026-06", skip: true },
      "hh-1",
      "user-1",
      preState,
    );

    expect(updatePayloads()).toContainEqual({ skipped_months: ["2026-05", "2026-06"] });
  });

  it("tar bort månaden ur skipped_months när skip ångras", async () => {
    const preState: AppState = {
      ...baseState,
      recurringTransactions: [makeRecurring({ skippedMonths: ["2026-05", "2026-06"] })],
    };

    await writeToSupabase(
      { type: "TOGGLE_RECURRING_SKIP", id: "r1", monthKey: "2026-06", skip: false },
      "hh-1",
      "user-1",
      preState,
    );

    expect(updatePayloads()).toContainEqual({ skipped_months: ["2026-05"] });
  });

  it("kastar när Supabase svarar med PostgREST-fel i stället för att misslyckas tyst", async () => {
    supa.state.response = { error: { message: "permission denied for table transactions" } };

    await expect(
      writeToSupabase({ type: "DELETE_TX", id: "t1" }, "hh-1", "user-1", baseState),
    ).rejects.toThrow("permission denied");
  });
});

import { describe, it, expect } from "vitest";
import { computeIncomeSyncs } from "@/store/income-sync";
import { RecurringTransaction } from "@/types/budget";

function makeRecurring(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: "r-1",
    description: "Lön",
    amount: 30000,
    type: "income",
    categoryId: "cat-1",
    payerId: "p-1",
    dayOfMonth: 25,
    isActive: true,
    lastGeneratedMonth: null,
    ...overrides,
  };
}

describe("computeIncomeSyncs", () => {
  it("synkar betalarens inkomst när en ny återkommande inkomst läggs till", () => {
    const rt = makeRecurring({ id: "r-1", payerId: "p-1", amount: 30000 });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt }, []);
    expect(syncs).toEqual([{ payerId: "p-1", income: 30000 }]);
  });

  it("summerar alla aktiva inkomster för betalaren, inte bara den nya", () => {
    const existing = makeRecurring({ id: "r-1", payerId: "p-1", amount: 30000 });
    const added = makeRecurring({ id: "r-2", payerId: "p-1", amount: 5000, description: "Bonus" });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt: added }, [existing]);
    expect(syncs).toEqual([{ payerId: "p-1", income: 35000 }]);
  });

  it("synkar BÅDE gammal och ny betalare när inkomstens payer byts", () => {
    const before = makeRecurring({ id: "r-1", payerId: "p-1", amount: 30000 });
    const moved = makeRecurring({ id: "r-1", payerId: "p-2", amount: 30000 });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt: moved }, [before]);
    // p-1 ska nollställas (inga inkomster kvar), p-2 ska få 30000
    expect(syncs).toContainEqual({ payerId: "p-1", income: 0 });
    expect(syncs).toContainEqual({ payerId: "p-2", income: 30000 });
    expect(syncs).toHaveLength(2);
  });

  it("synkar betalaren när en återkommande inkomst tas bort", () => {
    const inc = makeRecurring({ id: "r-1", payerId: "p-1", amount: 30000 });
    const syncs = computeIncomeSyncs({ type: "DELETE_RECURRING", id: "r-1" }, [inc]);
    expect(syncs).toEqual([{ payerId: "p-1", income: 0 }]);
  });

  it("räknar inte med inaktiva inkomster i summan", () => {
    const active = makeRecurring({ id: "r-1", payerId: "p-1", amount: 30000 });
    const inactive = makeRecurring({ id: "r-2", payerId: "p-1", amount: 9999, isActive: false });
    const added = makeRecurring({ id: "r-3", payerId: "p-1", amount: 5000 });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt: added }, [active, inactive]);
    expect(syncs).toEqual([{ payerId: "p-1", income: 35000 }]);
  });

  it("ger inga synkar för återkommande utgifter", () => {
    const expense = makeRecurring({ id: "r-1", type: "expense", payerId: "p-1", amount: 8000 });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt: expense }, []);
    expect(syncs).toEqual([]);
  });

  it("synkar gamla betalaren när en inkomst ändras till utgift", () => {
    const before = makeRecurring({ id: "r-1", type: "income", payerId: "p-1", amount: 30000 });
    const nowExpense = makeRecurring({ id: "r-1", type: "expense", payerId: "p-1", amount: 30000 });
    const syncs = computeIncomeSyncs({ type: "UPSERT_RECURRING", rt: nowExpense }, [before]);
    expect(syncs).toEqual([{ payerId: "p-1", income: 0 }]);
  });

  it("ger inga synkar för orelaterade actions", () => {
    const syncs = computeIncomeSyncs({ type: "DELETE_TX", id: "t-1" }, [makeRecurring()]);
    expect(syncs).toEqual([]);
  });
});

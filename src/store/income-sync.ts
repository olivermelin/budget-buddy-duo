import { Action } from "@/store/reducer";
import { RecurringTransaction } from "@/types/budget";

/**
 * Beräknar vilka personers månadsinkomst som behöver synkas när en återkommande
 * inkomst läggs till, ändras eller tas bort. Ren funktion — inga bieffekter.
 *
 * Returnerar en post per berörd betalare med summan av personens ALLA aktiva
 * återkommande inkomster efter att action applicerats. Hanterar även byte av
 * betalare (gammal + ny synkas) och typändring income→expense / borttagning
 * (gammal betalare nollställs).
 */
export function computeIncomeSyncs(
  action: Action,
  prevRecurrings: RecurringTransaction[],
): { payerId: string; income: number }[] {
  const affected = new Set<string>();
  let updated: RecurringTransaction[];

  if (action.type === "UPSERT_RECURRING") {
    const prev = prevRecurrings.find(r => r.id === action.rt.id);
    if (prev?.type === "income" && prev.payerId) affected.add(prev.payerId);
    if (action.rt.type === "income" && action.rt.payerId) affected.add(action.rt.payerId);
    updated = prev
      ? prevRecurrings.map(r => r.id === action.rt.id ? action.rt : r)
      : [...prevRecurrings, action.rt];
  } else if (action.type === "DELETE_RECURRING") {
    const removed = prevRecurrings.find(r => r.id === action.id);
    if (removed?.type === "income" && removed.payerId) affected.add(removed.payerId);
    updated = prevRecurrings.filter(r => r.id !== action.id);
  } else {
    return [];
  }

  return [...affected].map(payerId => ({
    payerId,
    income: updated
      .filter(r => r.type === "income" && r.isActive && r.payerId === payerId)
      .reduce((sum, r) => sum + r.amount, 0),
  }));
}

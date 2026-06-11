import { toast } from "sonner";
import { Transaction } from "@/types/budget";
import { Action } from "@/store/reducer";

/**
 * Raderar en transaktion men erbjuder ångra via en toast-knapp.
 * Hela transaktionsobjektet (inkl. id, isPrivate, ownerId, isRecurring) sparas och
 * återanvänds vid ångra — ADD_TX accepterar befintligt id, så raden återställs identiskt
 * och skrivs tillbaka till Supabase med samma id.
 */
export function deleteTxWithUndo(tx: Transaction, dispatch: (action: Action) => void) {
  dispatch({ type: "DELETE_TX", id: tx.id });
  toast("Transaktion borttagen", {
    action: {
      label: "Ångra",
      onClick: () => dispatch({ type: "ADD_TX", tx }),
    },
  });
}

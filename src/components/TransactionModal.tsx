import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Transaction } from "@/types/budget";
import { DatePicker } from "@/components/DatePicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCategoryId?: string;
  transaction?: Transaction | null;
}

export function TransactionModal({ open, onOpenChange, defaultCategoryId, transaction }: Props) {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const isEdit = !!transaction;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? state.categories[0]?.id);
  const [payerId, setPayerId] = useState(state.persons[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type);
        setAmount(transaction.amount);
        setDate(transaction.date.split("T")[0]);
        setCategoryId(transaction.categoryId);
        setPayerId(transaction.payerId);
        setDescription(transaction.description);
        setIsPrivate(!!transaction.isPrivate);
      } else {
        setType("expense");
        setAmount(0);
        setDate(new Date().toISOString().split("T")[0]);
        setCategoryId(defaultCategoryId ?? state.categories[0]?.id);
        setPayerId(user?.id ?? state.persons[0]?.id ?? "");
        setDescription("");
        setIsPrivate(false);
      }
    }
  }, [open, defaultCategoryId, state.categories, state.persons, transaction, user?.id]);

  // En transaktion kan endast vara privat för den inloggade användaren — du kan inte
  // sätta privat på sambons betalningar.
  const canBePrivate = !!user?.id && payerId === user.id;
  const effectivePrivate = canBePrivate && isPrivate;

  const submit = () => {
    const num = amount;
    if (!num || num <= 0) { toast.error("Ange ett belopp"); return; }
    if (!description.trim()) { toast.error("Lägg till beskrivning"); return; }
    const isoDate = `${date}T12:00:00.000Z`;
    if (transaction) {
      dispatch({
        type: "UPDATE_TX",
        id: transaction.id,
        patch: {
          date: isoDate,
          amount: num,
          type,
          categoryId,
          payerId,
          description: description.trim(),
          isPrivate: effectivePrivate,
          // Synka ownerId: sätt vid privatisering, rensa vid avprivatisering
          ownerId: effectivePrivate ? user?.id : undefined,
        },
      });
      toast.success("Transaktion uppdaterad");
    } else {
      dispatch({
        type: "ADD_TX",
        tx: {
          date: isoDate,
          amount: num,
          type,
          categoryId,
          payerId,
          description: description.trim(),
          isPrivate: effectivePrivate,
          ownerId: effectivePrivate ? user?.id : undefined,
        },
      });
      toast.success(type === "expense" ? "Utgift sparad" : "Inkomst sparad");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{isEdit ? "Redigera transaktion" : "Ny transaktion"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div role="group" aria-label="Transaktionstyp" className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setType("expense")}
              aria-pressed={type === "expense"}
              className={cn("py-2 rounded-lg text-sm font-medium transition", type === "expense" ? "bg-card shadow-soft" : "text-muted-foreground")}
            >Utgift</button>
            <button
              onClick={() => setType("income")}
              aria-pressed={type === "income"}
              className={cn("py-2 rounded-lg text-sm font-medium transition", type === "income" ? "bg-card shadow-soft" : "text-muted-foreground")}
            >Inkomst</button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-amount">Belopp (SEK)</Label>
            <NumericInput
              id="tx-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0"
              className="text-2xl font-display font-bold h-14 rounded-xl"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Datum</Label>
              <DatePicker value={date} onChange={setDate} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-payer">{type === "expense" ? "Betalare" : "Mottagare"}</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger id="tx-payer" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.persons.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-category">Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="tx-category" className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {state.categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="mr-2">{c.icon}</span>{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Beskrivning</Label>
            <Textarea
              id="tx-description"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="T.ex. ICA Maxi"
              className="rounded-xl resize-none"
            />
          </div>

          {canBePrivate && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Switch
                id="tx-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                aria-label="Markera som privat"
              />
              <div className="flex-1 min-w-0">
                <Label htmlFor="tx-private" className="flex items-center gap-1.5 cursor-pointer">
                  <Lock className="h-3.5 w-3.5" /> Privat utgift
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Syns endast för dig — ingår inte i parlägets uppdelning.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary rounded-xl">{isEdit ? "Uppdatera" : "Spara"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

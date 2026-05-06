import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useBudget } from "@/store/budget-store";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Transaction } from "@/types/budget";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCategoryId?: string;
  transaction?: Transaction | null;
}

export function TransactionModal({ open, onOpenChange, defaultCategoryId, transaction }: Props) {
  const { state, dispatch } = useBudget();
  const isEdit = !!transaction;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? state.categories[0]?.id);
  const [payerId, setPayerId] = useState(state.persons[0]?.id ?? "");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type);
        setAmount(String(transaction.amount));
        setDate(new Date(transaction.date));
        setCategoryId(transaction.categoryId);
        setPayerId(transaction.payerId);
        setDescription(transaction.description);
      } else {
        setType("expense");
        setAmount("");
        setDate(new Date());
        setCategoryId(defaultCategoryId ?? state.categories[0]?.id);
        setPayerId(state.persons[0]?.id ?? "");
        setDescription("");
      }
    }
  }, [open, defaultCategoryId, state.categories, state.persons, transaction]);

  const submit = () => {
    const num = parseFloat(amount.replace(",", "."));
    if (!num || num <= 0) { toast.error("Ange ett belopp"); return; }
    if (!description.trim()) { toast.error("Lägg till beskrivning"); return; }
    if (transaction) {
      dispatch({
        type: "UPDATE_TX",
        id: transaction.id,
        patch: {
          date: date.toISOString(),
          amount: num,
          type,
          categoryId,
          payerId,
          description: description.trim(),
        },
      });
      toast.success("Transaktion uppdaterad");
    } else {
      dispatch({
        type: "ADD_TX",
        tx: {
          date: date.toISOString(),
          amount: num,
          type,
          categoryId,
          payerId,
          description: description.trim(),
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
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="text-2xl font-display font-bold h-14 rounded-xl"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="tx-date" variant="outline" className="w-full justify-start rounded-xl">
                    <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                    {format(date, "d MMM yyyy", { locale: sv })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
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
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary rounded-xl">{isEdit ? "Uppdatera" : "Spara"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

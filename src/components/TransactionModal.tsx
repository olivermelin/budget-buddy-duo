import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Lock, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Transaction } from "@/types/budget";
import { DatePicker } from "@/components/DatePicker";
import { matchRule } from "@/lib/csv-import";
import { sek } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCategoryId?: string;
  transaction?: Transaction | null;
  settlementMode?: {
    from: string; // personId
    to: string;   // personId
    amount: number;
  };
}

export function TransactionModal({ open, onOpenChange, defaultCategoryId, transaction, settlementMode }: Props) {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const isEdit = !!transaction;
  const isSettlement = !!settlementMode || transaction?.type === "settlement";
  const [type, setType] = useState<"expense" | "income" | "settlement">("expense");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? state.categories[0]?.id);
  const [payerId, setPayerId] = useState(state.persons[0]?.id ?? "");
  const [receiverId, setReceiverId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  // true när användaren själv valt kategori — då skriver vi inte över den automatiskt
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [splitCustom, setSplitCustom] = useState(false);
  const [splitShare0, setSplitShare0] = useState(50); // person[0]:s andel i procent

  const p0 = state.persons[0];
  const p1 = state.persons[1];

  // Mest använda kategorin bland de senaste utgifterna — bättre startgissning
  // än första kategorin i listan.
  const defaultExpenseCategoryId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of state.transactions.slice(0, 30)) {
      if (t.type !== "expense" || !t.categoryId) continue;
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    }
    let best = "";
    let bestN = 0;
    for (const [id, n] of counts) {
      if (n > bestN && state.categories.some(c => c.id === id && !c.isIncome)) { best = id; bestN = n; }
    }
    return best || state.categories.find(c => !c.isIncome)?.id || state.categories[0]?.id;
  }, [state.transactions, state.categories]);

  useEffect(() => {
    if (open) {
      if (isSettlement && settlementMode) {
        setType("settlement");
        setAmount(settlementMode.amount);
        setDate(new Date().toISOString().split("T")[0]);
        setPayerId(settlementMode.from);
        setReceiverId(settlementMode.to);
        setDescription("");
        setCategoryId("");
        setIsPrivate(false);
      } else if (transaction?.type === "settlement") {
        setType("settlement");
        setAmount(transaction.amount);
        setDate(transaction.date.split("T")[0]);
        setPayerId(transaction.payerId);
        setReceiverId(transaction.receiverId ?? "");
        setDescription("");
        setCategoryId("");
        setIsPrivate(false);
      } else if (transaction) {
        setType(transaction.type);
        setAmount(transaction.amount);
        setDate(transaction.date.split("T")[0]);
        setCategoryId(transaction.categoryId ?? "");
        setPayerId(transaction.payerId);
        setReceiverId(transaction.receiverId ?? "");
        setDescription(transaction.description);
        setIsPrivate(!!transaction.isPrivate);
        setCategoryTouched(true); // redigering: rör aldrig kategorin automatiskt
        const shares = transaction.splitShares;
        const sharesSum = shares ? Object.values(shares).reduce((s, v) => s + v, 0) : 0;
        setSplitCustom(sharesSum > 0);
        setSplitShare0(sharesSum > 0 && state.persons[0] ? Math.round(shares?.[state.persons[0].id] ?? 50) : 50);
      } else {
        setType("expense");
        setAmount(0);
        setDate(new Date().toISOString().split("T")[0]);
        setCategoryId(defaultCategoryId ?? defaultExpenseCategoryId);
        setPayerId(user?.id ?? state.persons[0]?.id ?? "");
        setReceiverId("");
        setDescription("");
        setIsPrivate(false);
        setCategoryTouched(!!defaultCategoryId);
        setSplitCustom(false);
        setSplitShare0(50);
      }
    }
  }, [open, defaultCategoryId, defaultExpenseCategoryId, state.categories, state.persons, transaction, user?.id, isSettlement, settlementMode]);

  // Autocomplete: matcha tidigare transaktioner på beskrivning (nya transaktioner).
  const suggestions = useMemo(() => {
    if (isSettlement || isEdit) return [];
    const q = description.trim().toLowerCase();
    if (q.length < 2) return [];
    const byKey = new Map<string, { description: string; categoryId?: string; amount: number; count: number; lastDate: string }>();
    for (const t of state.transactions) {
      if (t.type !== type) continue;
      const key = t.description.trim().toLowerCase();
      if (!key || key === q || !key.includes(q)) continue;
      const e = byKey.get(key);
      if (e) {
        e.count++;
        if (t.date > e.lastDate) { e.lastDate = t.date; e.amount = t.amount; e.categoryId = t.categoryId; }
      } else {
        byKey.set(key, { description: t.description.trim(), categoryId: t.categoryId, amount: t.amount, count: 1, lastDate: t.date });
      }
    }
    return [...byKey.values()]
      .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
      .slice(0, 4);
  }, [description, state.transactions, type, isSettlement, isEdit]);

  const applySuggestion = (s: (typeof suggestions)[number]) => {
    setDescription(s.description);
    if (s.categoryId && state.categories.some(c => c.id === s.categoryId)) {
      setCategoryId(s.categoryId);
      setCategoryTouched(true);
    }
    if (!amount) setAmount(s.amount);
  };

  // Auto-kategorisera från importregler medan man skriver — tills användaren
  // själv valt kategori. Samma regelmotor som CSV-importen.
  useEffect(() => {
    if (!open || isEdit || isSettlement || categoryTouched || type !== "expense") return;
    const desc = description.trim();
    if (desc.length < 2) return;
    const rule = matchRule(desc, state.importRules);
    if (rule?.categoryId && state.categories.some(c => c.id === rule.categoryId)) {
      setCategoryId(rule.categoryId);
    }
  }, [description, open, isEdit, isSettlement, categoryTouched, type, state.importRules, state.categories]);

  // En transaktion kan endast vara privat för den inloggade användaren — du kan inte
  // sätta privat på sambons betalningar.
  const canBePrivate = !!user?.id && payerId === user.id;
  const effectivePrivate = canBePrivate && isPrivate;

  const submit = () => {
    const num = amount;
    if (!num || num <= 0) { toast.error("Ange ett belopp"); return; }
    
    if (type === "settlement") {
      if (!payerId || !receiverId) { toast.error("Välj avsändare och mottagare"); return; }
      if (payerId === receiverId) { toast.error("Avsändare och mottagare måste vara olika"); return; }
      const householdIds = new Set(state.persons.map(p => p.id));
      if (!householdIds.has(receiverId)) { toast.error("Mottagaren tillhör inte hushållet"); return; }
      const isoDate = `${date}T12:00:00.000Z`;
      const desc = `${state.persons.find(p => p.id === payerId)?.name ?? "Okänd"} betalade ${state.persons.find(p => p.id === receiverId)?.name ?? "Okänd"}`;
      if (transaction) {
        dispatch({
          type: "UPDATE_TX",
          id: transaction.id,
          patch: { date: isoDate, amount: num, type: "settlement", payerId, receiverId, description: desc, categoryId: "" },
        });
        toast.success("Betalning uppdaterad");
      } else {
        dispatch({
          type: "ADD_TX",
          tx: { date: isoDate, amount: num, type: "settlement", payerId, receiverId, description: desc },
        });
        toast.success("Betalning sparad");
      }
    } else {
      if (!description.trim()) { toast.error("Lägg till beskrivning"); return; }
      const isoDate = `${date}T12:00:00.000Z`;

      // Anpassad fördelning gäller endast delade utgifter i tvåpersonershushåll.
      // En 50/50-delning är identisk med standard (rörliga delas alltid lika), så den
      // sparas INTE som anpassad — annars hamnar utgiften felaktigt utanför "Rörliga
      // utgifter" i fördelningen utan att fördelningen faktiskt skiljer sig.
      const isEqualSplit = splitShare0 === 50;
      const splitShares =
        type === "expense" && !effectivePrivate && splitCustom && !isEqualSplit && p0 && p1
          ? { [p0.id]: splitShare0, [p1.id]: 100 - splitShare0 }
          : undefined;

      if (transaction) {
        // Inkludera splitShares-nyckeln endast vid faktisk ändring — annars
        // fungerar uppdateringar även innan migration 0024 körts.
        const splitChanged =
          JSON.stringify(transaction.splitShares ?? null) !== JSON.stringify(splitShares ?? null);
        dispatch({
          type: "UPDATE_TX",
          id: transaction.id,
          patch: {
            date: isoDate,
            amount: num,
            type: type as "expense" | "income",
            categoryId,
            payerId,
            description: description.trim(),
            isPrivate: effectivePrivate,
            ownerId: effectivePrivate ? user?.id : undefined,
            ...(splitChanged ? { splitShares } : {}),
          },
        });
        toast.success("Transaktion uppdaterad");

        // Regelförslag: kategorin rättades → erbjud en importregel så att
        // liknande transaktioner kategoriseras automatiskt framöver.
        const desc = description.trim();
        if (type === "expense" && categoryId && categoryId !== transaction.categoryId && desc) {
          const existing = matchRule(desc, state.importRules);
          if (!existing || existing.categoryId !== categoryId) {
            const cat = state.categories.find(c => c.id === categoryId);
            toast(`Alltid ${cat?.icon ?? ""} ${cat?.name ?? "denna kategori"} för «${desc}»?`, {
              description: "Skapa en regel så kategoriseras liknande transaktioner automatiskt.",
              action: {
                label: "Skapa regel",
                onClick: () => {
                  dispatch({
                    type: "UPSERT_RULE",
                    rule: {
                      id: crypto.randomUUID(),
                      pattern: desc,
                      matchType: "contains",
                      categoryId,
                      payerId: null,
                      priority: 10,
                      isPrivate: false,
                    },
                  });
                  toast.success("Regel skapad");
                },
              },
            });
          }
        }
      } else {
        dispatch({
          type: "ADD_TX",
          tx: {
            date: isoDate,
            amount: num,
            type: type as "expense" | "income",
            categoryId,
            payerId,
            description: description.trim(),
            isPrivate: effectivePrivate,
            ownerId: effectivePrivate ? user?.id : undefined,
            splitShares,
          },
        });
        toast.success(type === "expense" ? "Utgift sparad" : "Inkomst sparad");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isSettlement ? "Registrera betalning" : isEdit ? "Redigera transaktion" : "Ny transaktion"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isSettlement && (
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
          )}

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
              <Label htmlFor="tx-payer">{isSettlement || type === "expense" ? "Betalare" : "Mottagare"}</Label>
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
            <Label htmlFor="tx-category">{isSettlement ? "Mottagare" : "Kategori"}</Label>
            {isSettlement ? (
              <Select value={receiverId} onValueChange={setReceiverId}>
                <SelectTrigger id="tx-category" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.persons.filter(p => p.id !== payerId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={categoryId} onValueChange={v => { setCategoryId(v); setCategoryTouched(true); }}>
                <SelectTrigger id="tx-category" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="mr-2">{c.icon}</span>{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!isSettlement && (
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
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Förslag från tidigare transaktioner">
                  {suggestions.map(s => (
                    <button
                      key={s.description}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <span className="truncate max-w-[160px]">{s.description}</span>
                      <span className="text-muted-foreground tabular-nums">{sek(s.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isSettlement && canBePrivate && (
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

          {/* Anpassad fördelning — endast delade utgifter i tvåpersonershushåll */}
          {!isSettlement && type === "expense" && !effectivePrivate && state.persons.length === 2 && (
            <div className="p-3 rounded-xl bg-muted/40 space-y-3">
              <div className="flex items-start gap-3">
                <Switch
                  id="tx-split"
                  checked={splitCustom}
                  onCheckedChange={setSplitCustom}
                  aria-label="Anpassad fördelning"
                />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="tx-split" className="flex items-center gap-1.5 cursor-pointer">
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Anpassad fördelning
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {splitCustom
                      ? "Just denna utgift delas enligt andelarna nedan."
                      : "Delas enligt hushållets standardregler."}
                  </p>
                </div>
              </div>
              {splitCustom && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p0.name}: <span className="font-semibold text-foreground">{splitShare0}%</span></span>
                    <span>{p1.name}: <span className="font-semibold text-foreground">{100 - splitShare0}%</span></span>
                  </div>
                  <Slider
                    value={[splitShare0]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={v => setSplitShare0(v[0])}
                    aria-label={`Andel för ${p0.name}`}
                  />
                  {amount > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {p0.name} står för {sek(Math.round(amount * splitShare0 / 100))} och {p1.name} för {sek(Math.round(amount * (100 - splitShare0) / 100))}.
                    </p>
                  )}
                </div>
              )}
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

import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { sek, dateLabel, monthKey, monthLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Plus, Search, Trash2, FileSpreadsheet, FileText, Pencil, X, Tag, UserCog, Lock, ArrowRightLeft } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { exportTransactionsPDF, exportTransactionsXLSX } from "@/lib/export";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Transaction } from "@/types/budget";
import { deleteTxWithUndo } from "@/lib/tx-actions";

export default function Transactions() {
  const { state, dispatch } = useBudget();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [person, setPerson] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.transactions) set.add(monthKey(t.date));
    return [...set].sort().reverse();
  }, [state.transactions]);

  const filtered = useMemo(() => {
    return state.transactions.filter(t => {
      if (month !== "all" && monthKey(t.date) !== month) return false;
      if (cat !== "all" && t.categoryId !== cat) return false;
      if (person !== "all" && t.payerId !== person) return false;
      if (q && !t.description.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [state.transactions, q, month, cat, person]);

  const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));
  const personMap = Object.fromEntries(state.persons.map(p => [p.id, p]));

  const total = filtered.reduce((s, t) => {
    if (t.type === "settlement") return s;
    return s + (t.type === "income" ? t.amount : -t.amount);
  }, 0);

  const visibleIds = useMemo(() => filtered.map(t => t.id), [filtered]);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      for (const id of visibleIds) next.delete(id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const id of visibleIds) next.add(id);
      setSelected(next);
    }
  };

  const clearSelection = () => setSelected(new Set());

  const bulkSetCategory = (categoryId: string) => {
    for (const id of selected) dispatch({ type: "UPDATE_TX", id, patch: { categoryId } });
    toast.success(`${selected.size} transaktioner uppdaterade`);
    clearSelection();
  };

  const bulkSetPayer = (payerId: string) => {
    for (const id of selected) dispatch({ type: "UPDATE_TX", id, patch: { payerId } });
    toast.success(`${selected.size} transaktioner uppdaterade`);
    clearSelection();
  };

  const bulkDelete = () => {
    const count = selected.size;
    for (const id of selected) dispatch({ type: "DELETE_TX", id });
    toast.success(`${count} transaktioner borttagna`);
    clearSelection();
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Transaktioner</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} st · netto {sek(total)}</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl"><Download className="h-4 w-4" /> Exportera</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { exportTransactionsXLSX({ transactions: filtered, categories: state.categories, persons: state.persons }); toast.success("Excel exporterad"); }}>
                <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { exportTransactionsPDF({ transactions: filtered, categories: state.categories, persons: state.persons }); toast.success("PDF exporterad"); }}>
                <FileText className="h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary rounded-xl"><Plus className="h-4 w-4" /> Ny</Button>
        </div>
      </div>

      <Card className="p-3 md:p-4 rounded-2xl shadow-soft border-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök beskrivning…" className="pl-9 rounded-xl" />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Månad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla månader</SelectItem>
              {months.map(m => <SelectItem key={m} value={m} className="capitalize">{monthLabel(new Date(m + "-01"))}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {state.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger className="rounded-xl col-span-2 md:col-span-1"><SelectValue placeholder="Person" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla personer</SelectItem>
              {state.persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Markera alla synliga"
          />
          <span className="text-xs text-muted-foreground">
            {someSelected ? `${selected.size} markerade` : "Markera alla synliga"}
          </span>
        </div>
      )}

      <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
        {filtered.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Inga transaktioner matchar filtren.</div>}
        {filtered.map(t => {
          const c = catMap[t.categoryId ?? ""];
          const p = personMap[t.payerId];
          const receiver = t.type === "settlement" ? personMap[t.receiverId ?? ""] : undefined;
          const isSel = selected.has(t.id);
          const isSettlement = t.type === "settlement";
          return (
            <div key={t.id} className={cn("flex items-center gap-3 p-4 hover:bg-muted/30 group transition", isSel && "bg-primary/5")}>
              <Checkbox
                checked={isSel}
                onCheckedChange={() => toggleOne(t.id)}
                aria-label={`Markera ${t.description}`}
              />
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`Redigera ${t.description}`}
              >
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0",
                  isSettlement ? "bg-muted" : undefined
                )} style={!isSettlement ? { backgroundColor: `hsl(${c?.color} / 0.15)` } : undefined}>
                  {isSettlement
                    ? <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    : c?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {t.isPrivate && (
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Privat — syns endast för dig" />
                    )}
                    <span className="truncate">{t.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateLabel(t.date)} · {p?.name}
                    {isSettlement && receiver ? ` → ${receiver.name}` : ` · ${c?.name ?? ""}`}
                  </div>
                </div>
              </button>
              <div className={cn(
                "font-display font-bold tabular-nums",
                t.type === "income" ? "text-success" : t.type === "settlement" ? "text-muted-foreground" : "text-foreground"
              )}>
                {t.type === "income" ? "+" : t.type === "settlement" ? "" : "−"}{sek(t.amount)}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing(t)}
                  aria-label={`Redigera ${t.description}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTxWithUndo(t, dispatch)}
                  aria-label={`Ta bort ${t.description}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Bulk-actions bar */}
      {someSelected && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 px-3 w-[min(680px,95vw)]">
          <div className="rounded-2xl bg-popover border border-border shadow-glow px-3 py-2 flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon" onClick={clearSelection} className="h-8 w-8" aria-label="Avmarkera">
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium pr-2 border-r border-border">{selected.size} markerade</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-lg"><Tag className="h-4 w-4" /> Kategori</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                {state.categories.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => bulkSetCategory(c.id)}>
                    <span className="mr-1">{c.icon}</span> {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-lg"><UserCog className="h-4 w-4" /> Person</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {state.persons.map(p => (
                  <DropdownMenuItem key={p.id} onClick={() => bulkSetPayer(p.id)}>{p.name}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-destructive hover:text-destructive ml-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Ta bort
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {selected.size} transaktioner?</AlertDialogTitle>
            <AlertDialogDescription>Detta går inte att ångra.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransactionModal open={open} onOpenChange={setOpen} />
      <TransactionModal
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        transaction={editing}
      />
    </div>
  );
}

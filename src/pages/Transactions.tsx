import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { sek, dateLabel, monthKey, monthLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Plus, Search, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { exportTransactionsPDF, exportTransactionsXLSX } from "@/lib/export";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Transactions() {
  const { state, dispatch } = useBudget();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [person, setPerson] = useState<string>("all");

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

  const total = filtered.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

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

      <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
        {filtered.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Inga transaktioner matchar filtren.</div>}
        {filtered.map(t => {
          const c = catMap[t.categoryId];
          const p = personMap[t.payerId];
          return (
            <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 group transition">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `hsl(${c?.color} / 0.15)` }}
              >{c?.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{t.description}</div>
                <div className="text-xs text-muted-foreground">{dateLabel(t.date)} · {p?.name} · {c?.name}</div>
              </div>
              <div className={cn(
                "font-display font-bold tabular-nums",
                t.type === "income" ? "text-success" : "text-foreground"
              )}>
                {t.type === "income" ? "+" : "−"}{sek(t.amount)}
              </div>
              <Button
                variant="ghost" size="icon"
                className="opacity-0 group-hover:opacity-100 transition h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => { dispatch({ type: "DELETE_TX", id: t.id }); toast.success("Borttagen"); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </Card>

      <TransactionModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

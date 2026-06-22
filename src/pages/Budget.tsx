import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { summarizeMonth, computeEffectiveBudgets, inMonth } from "@/lib/analytics";
import { sek, pct, monthLabel, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Plus, Trash2, Pencil, Lock, Sparkles, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RecurringTransaction } from "@/types/budget";
import { NumericInput } from "@/components/ui/numeric-input";
import { SubscriptionsPanel } from "@/components/SubscriptionsPanel";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useMonthNavigator } from "@/hooks/useMonthNavigator";

const ICONS = ["🛒", "🏠", "🚗", "🎬", "🛍️", "📱", "✈️", "✨", "🍽️", "💪", "📚", "🐾", "💊", "🎁"];

type SuggestedCategory = Omit<import("@/types/budget").Category, "id">;

const SUGGESTED_CATEGORIES: SuggestedCategory[] = [
  { name: "Lön",                icon: "💰", color: "142 71% 45%", budget: 0,    isFixed: false, isIncome: true  },
  { name: "Övriga inkomster",   icon: "💵", color: "152 60% 40%", budget: 0,    isFixed: false, isIncome: true  },
  { name: "Boende",             icon: "🏠", color: "222 47% 17%", budget: 0,    isFixed: true,  isIncome: false },
  { name: "Bredband & TV",      icon: "📡", color: "199 84% 43%", budget: 0,    isFixed: true,  isIncome: false },
  { name: "Abonnemang",         icon: "📱", color: "198 84% 43%", budget: 0,    isFixed: true,  isIncome: false },
  { name: "Försäkringar",       icon: "🛡️", color: "30 80% 50%",  budget: 0,    isFixed: true,  isIncome: false },
  { name: "Mat & Dagligvaror",  icon: "🛒", color: "158 64% 42%", budget: 4000, isFixed: false, isIncome: false },
  { name: "Restaurang & Café",  icon: "🍽️", color: "25 85% 55%",  budget: 1500, isFixed: false, isIncome: false },
  { name: "Transport",          icon: "🚗", color: "38 92% 50%",  budget: 1500, isFixed: false, isIncome: false },
  { name: "Hälsa & Träning",    icon: "🏃", color: "172 60% 40%", budget: 600,  isFixed: false, isIncome: false },
  { name: "Shopping & Kläder",  icon: "👕", color: "340 75% 55%", budget: 1500, isFixed: false, isIncome: false },
  { name: "Hem & Inredning",    icon: "🛋️", color: "210 60% 45%", budget: 1000, isFixed: false, isIncome: false },
  { name: "Nöje & Aktiviteter", icon: "🎬", color: "271 77% 57%", budget: 1000, isFixed: false, isIncome: false },
  { name: "Resor & Semester",   icon: "✈️", color: "168 70% 38%", budget: 3000, isFixed: false, isIncome: false },
  { name: "Övrigt",             icon: "📦", color: "215 16% 47%", budget: 500,  isFixed: false, isIncome: false },
];

// Match by first significant word so "Mat & Hushåll" blocks "Mat & Dagligvaror"
const normKey = (name: string) => name.toLowerCase().split(/[\s&,]/)[0].trim();

type PlanTab = "budget" | "prenumerationer";

export default function Budget() {
  const [tab, setTab] = useState<PlanTab>("budget");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Planera</h1>
        <p className="text-sm text-muted-foreground mt-1">Budget, återkommande poster och prenumerationer.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([
          { id: "budget", label: "Budget" },
          { id: "prenumerationer", label: "Prenumerationer" },
        ] as { id: PlanTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition",
              tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "budget" && <BudgetTab />}
      {tab === "prenumerationer" && <SubscriptionsPanel />}
    </div>
  );
}

function BudgetTab() {
  const { state } = useBudget();
  const { offset, monthDate, prev, next, canGoNext } = useMonthNavigator();
  const summary = useMemo(() => summarizeMonth(state, monthDate.getFullYear(), monthDate.getMonth()), [state, offset]);
  const effectiveBudgets = useMemo(() => computeEffectiveBudgets(state), [state]);
  const [drillId, setDrillId] = useState<string | null>(null);

  const expenseCategories = state.categories.filter(c => !c.isIncome);
  const totalBudget = expenseCategories.reduce((s, c) => s + (effectiveBudgets[c.id] ?? c.budget), 0);
  const totalSpent = expenseCategories.reduce((s, c) => s + (summary.byCategory[c.id] || 0), 0);

  const drillCat = drillId ? state.categories.find(c => c.id === drillId) : null;
  const drillTxs = drillCat
    ? state.transactions
        .filter(t => t.type === "expense" && t.categoryId === drillCat.id && !t.isPrivate)
        .filter(t => inMonth(t.date, monthDate.getFullYear(), monthDate.getMonth(), state.settings.payDay ?? 1))
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const personMap = Object.fromEntries(state.persons.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <MonthNavigator label={monthLabel(monthDate)} onPrev={prev} onNext={next} canGoNext={canGoNext} />
      </div>

      <Card className="p-6 rounded-2xl shadow-soft border-0 bg-gradient-primary text-white">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm opacity-80">Total budget</p>
            <p className="text-3xl font-display font-bold mt-1">{sek(totalSpent)} <span className="text-base opacity-70 font-normal">av {sek(totalBudget)}</span></p>
          </div>
          <div className="text-sm opacity-80">{pct(totalBudget ? totalSpent / totalBudget : 0)} förbrukat</div>
        </div>
        <div
          className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Total budgetförbrukning"
          aria-valuenow={Math.round((totalSpent / (totalBudget || 1)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }} />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        {expenseCategories.map(c => {
          const spent = summary.byCategory[c.id] || 0;
          const budget = effectiveBudgets[c.id] ?? c.budget;
          const ratio = budget ? spent / budget : 0;
          const tone = ratio > 1 ? "danger" : ratio > 0.85 ? "warn" : "ok";
          return (
            <Card
              key={c.id}
              className="p-5 rounded-2xl shadow-soft border-0 cursor-pointer hover:shadow-elegant transition"
              onClick={() => setDrillId(c.id)}
              role="button"
              tabIndex={0}
              aria-label={`${c.name} – ${sek(spent)} av ${sek(budget)}`}
              onKeyDown={e => (e.key === "Enter" || e.key === " ") && setDrillId(c.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `hsl(${c.color} / 0.15)` }}
                  >{c.icon}</div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{sek(spent)} av {sek(budget)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-display font-bold tabular-nums text-lg",
                    tone === "danger" && "text-destructive",
                    tone === "warn" && "text-warning",
                    tone === "ok" && "text-foreground",
                  )}>{pct(ratio)}</div>
                  {tone === "danger" && <div className="text-xs text-destructive flex items-center gap-1 justify-end"><AlertCircle className="h-3 w-3" />Överskriden</div>}
                  {tone === "warn" && <div className="text-xs text-warning">Nära gränsen</div>}
                </div>
              </div>
              <div
                className="mt-3 h-2 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-label={`${c.name} budgetförbrukning`}
                aria-valuenow={Math.round(Math.min(100, ratio * 100))}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn("h-full rounded-full transition-all", tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-destructive")}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Planering */}
      <div className="pt-2 space-y-4">
        <h2 className="text-xl font-display font-semibold">Planering</h2>
        <CategoriesEditor />
        <RecurringEditor />
      </div>

      <Dialog open={!!drillId} onOpenChange={v => !v && setDrillId(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-xl">
              {drillCat && <span className="text-2xl">{drillCat.icon}</span>}
              {drillCat?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground capitalize mb-2">{monthLabel(monthDate)}</div>
          <div className="max-h-96 overflow-auto -mx-6 px-6 divide-y divide-border">
            {drillTxs.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Inga transaktioner denna månad.</div>}
            {drillTxs.map(t => (
              <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {t.isPrivate && (
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Privat — syns endast för dig" />
                    )}
                    <span className="truncate">{t.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{dateLabel(t.date)} · {personMap[t.payerId]?.name}</div>
                </div>
                <div className="font-display font-bold tabular-nums">{sek(t.amount)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriesEditor() {
  const { state, dispatch } = useBudget();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<import("@/types/budget").Category | null>(null);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(0);
  const [icon, setIcon] = useState("✨");
  const [isIncome, setIsIncome] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  const effectiveBudgets = useMemo(() => computeEffectiveBudgets(state), [state]);

  const addSuggested = () => {
    const existingKeys = new Set(state.categories.map(c => normKey(c.name)));
    const toAdd = SUGGESTED_CATEGORIES.filter(s => !existingKeys.has(normKey(s.name)));
    if (!toAdd.length) { toast.info("Alla standardkategorier finns redan"); return; }
    toAdd.forEach(s => dispatch({ type: "UPSERT_CATEGORY", cat: { ...s, id: crypto.randomUUID() } }));
    toast.success(`${toAdd.length} kategorier tillagda`);
  };

  const openNew = () => {
    setEditing(null);
    setName(""); setBudget(0); setIcon("✨"); setIsIncome(false); setIsFixed(false);
    setOpen(true);
  };

  const openEdit = (c: import("@/types/budget").Category) => {
    setEditing(c);
    setName(c.name); setBudget(c.budget || 0); setIcon(c.icon);
    setIsIncome(!!c.isIncome); setIsFixed(!!c.isFixed);
    setOpen(true);
  };

  const save = () => {
    if (!name.trim()) { toast.error("Ange ett namn"); return; }
    dispatch({ type: "UPSERT_CATEGORY", cat: {
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      icon,
      color: editing?.color ?? `${Math.floor(Math.random() * 360)} 70% 50%`,
      budget: isIncome || isFixed ? 0 : budget,
      isFixed: isIncome ? false : isFixed,
      isIncome,
    }});
    toast.success(editing ? "Kategori uppdaterad" : "Kategori skapad");
    setOpen(false);
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold">Kategorier</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Används för att gruppera transaktioner</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addSuggested} className="rounded-xl gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Standardkategorier
          </Button>
          <Button size="sm" onClick={openNew} className="rounded-xl"><Plus className="h-4 w-4" /> Ny</Button>
        </div>
      </div>

      <div className="space-y-2">
        {state.categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <div className="text-xl w-8 text-center shrink-0">{c.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.isIncome
                  ? "Inkomst"
                  : c.isFixed
                  ? (effectiveBudgets[c.id] > 0
                    ? `Fast utgift · ${effectiveBudgets[c.id].toLocaleString("sv-SE")} kr/mån`
                    : "Fast utgift · inga aktiva återkommande poster – lägg till under Återkommande")
                  : c.budget
                  ? `Rörlig utgift · Budget ${c.budget.toLocaleString("sv-SE")} kr/mån`
                  : "Rörlig utgift"}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label={`Redigera ${c.name}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => dispatch({ type: "DELETE_CATEGORY", id: c.id })} aria-label={`Ta bort ${c.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {state.categories.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Inga kategorier än.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Redigera kategori" : "Ny kategori"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map(i => (
                  <button key={i} type="button" onClick={() => setIcon(i)}
                    className={cn("h-9 w-9 rounded-lg text-lg transition", icon === i ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-name">Namn</Label>
              <Input id="cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Mat, Lön, Bil" className="rounded-xl" autoFocus />
            </div>

            <div role="group" aria-label="Kategoritype" className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button type="button" onClick={() => { setIsIncome(false); setIsFixed(false); }} aria-pressed={!isIncome}
                className={cn("py-2 rounded-lg text-sm font-medium transition", !isIncome ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Utgift
              </button>
              <button type="button" onClick={() => { setIsIncome(true); setIsFixed(false); }} aria-pressed={isIncome}
                className={cn("py-2 rounded-lg text-sm font-medium transition", isIncome ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Inkomst
              </button>
            </div>

            {!isIncome && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Fast utgift</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Budgeten följer kategorins aktiva återkommande poster — ändrar du dem ändras budgeten. Sätts inte manuellt.</div>
                  </div>
                  <Switch id="cat-fixed" checked={isFixed} onCheckedChange={setIsFixed} />
                </div>

                {!isFixed && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    <Label htmlFor="cat-budget" className="text-xs text-muted-foreground">Månadsbudget (valfritt)</Label>
                    <div className="flex items-center gap-2">
                      <NumericInput id="cat-budget" value={budget} onChange={setBudget} placeholder="0" className="rounded-xl" />
                      <span className="text-sm text-muted-foreground shrink-0">kr/mån</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Avbryt</Button>
            <Button onClick={save} className="bg-gradient-primary rounded-xl">{editing ? "Spara" : "Skapa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RecurringEditor() {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [payerId, setPayerId] = useState(state.persons[0]?.id ?? "");
  const [day, setDay] = useState("25");
  const [isActive, setIsActive] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);

  // En privat mall kan endast tillhöra den inloggade användaren.
  const canBePrivate = !!user?.id && payerId === user.id;

  const openNew = () => {
    setEditing(null);
    setType("expense");
    setDescription("");
    setAmount(0);
    setCategoryId(state.categories[0]?.id ?? "");
    setPayerId(user?.id ?? state.persons[0]?.id ?? "");
    setDay("25");
    setIsActive(true);
    setIsPrivate(false);
    setOpen(true);
  };

  const openEdit = (rt: RecurringTransaction) => {
    setEditing(rt);
    // Återkommande är aldrig settlement; fall tillbaka på expense om typen breddas.
    setType(rt.type === "income" ? "income" : "expense");
    setDescription(rt.description);
    setAmount(rt.amount);
    setCategoryId(rt.categoryId);
    setPayerId(rt.payerId);
    setDay(String(rt.dayOfMonth));
    setIsActive(rt.isActive);
    setIsPrivate(!!rt.isPrivate);
    setOpen(true);
  };

  const save = () => {
    const num = amount;
    if (!num || num <= 0) { toast.error("Ange ett belopp"); return; }
    if (!description.trim()) { toast.error("Lägg till beskrivning"); return; }
    const dayNum = parseInt(day, 10);
    if (!dayNum || dayNum < 1 || dayNum > 31) { toast.error("Dag måste vara 1–31"); return; }

    const effectivePrivate = canBePrivate && isPrivate;
    const rt: RecurringTransaction = {
      id: editing?.id ?? crypto.randomUUID(),
      description: description.trim(),
      amount: num,
      type,
      categoryId,
      payerId,
      dayOfMonth: dayNum,
      isActive,
      lastGeneratedMonth: editing?.lastGeneratedMonth ?? null,
      skippedMonths: editing?.skippedMonths ?? [],
      isPrivate: effectivePrivate,
      ownerId: effectivePrivate ? user?.id : undefined,
    };
    dispatch({ type: "UPSERT_RECURRING", rt });
    toast.success(editing ? "Uppdaterad" : "Återkommande transaktion skapad");
    setOpen(false);
  };

  const remove = (id: string) => {
    dispatch({ type: "DELETE_RECURRING", id });
    toast.success("Borttagen");
  };

  const toggleActive = (rt: RecurringTransaction) =>
    dispatch({ type: "UPSERT_RECURRING", rt: { ...rt, isActive: !rt.isActive } });

  const typeLabel = (rt: RecurringTransaction) => rt.type === "income" ? "Inkomst" : "Utgift";
  const catName = (id: string) => state.categories.find(c => c.id === id)?.name ?? "–";
  const personName = (id: string) => state.persons.find(p => p.id === id)?.name ?? "–";

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold">Återkommande transaktioner</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Läggs in automatiskt varje månad</p>
        </div>
        <Button size="sm" onClick={openNew} className="rounded-xl"><Plus className="h-4 w-4" /> Ny</Button>
      </div>

      {state.recurringTransactions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Inga återkommande transaktioner än.</p>
      )}

      {(() => {
        const shared = state.recurringTransactions.filter(r => !r.isPrivate);
        const privates = state.recurringTransactions.filter(r => r.isPrivate);
        const sumActive = (rts: RecurringTransaction[]) =>
          rts.filter(r => r.isActive && r.type === "expense").reduce((s, r) => s + r.amount, 0);

        const renderRow = (rt: RecurringTransaction) => {
          const isSkippedThisMonth = rt.skippedMonths?.includes(currentMonthKey) ?? false;
          return (
            <div key={rt.id} className={cn("flex items-center gap-3 p-3 rounded-xl bg-muted/30", !rt.isActive && "opacity-50")}>
              <div className="text-lg w-8 text-center">{rt.type === "income" ? "💰" : "📅"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {rt.isPrivate && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Privat" />}
                  <span className="font-medium text-sm truncate">{rt.description}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", rt.type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {typeLabel(rt)}
                  </span>
                  {isSkippedThisMonth && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      Hoppad denna månad
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rt.amount.toLocaleString("sv-SE")} kr · dag {rt.dayOfMonth} · {catName(rt.categoryId)} · {personName(rt.payerId)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={rt.isActive} onCheckedChange={() => toggleActive(rt)} aria-label={rt.isActive ? "Inaktivera" : "Aktivera"} />
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", isSkippedThisMonth ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}
                  onClick={() => {
                    dispatch({ type: "TOGGLE_RECURRING_SKIP", id: rt.id, monthKey: currentMonthKey, skip: !isSkippedThisMonth });
                    toast.success(isSkippedThisMonth ? `${rt.description} aktiveras igen denna månad` : `${rt.description} hoppas över denna månad`);
                  }}
                  title={isSkippedThisMonth ? "Ångra skip denna månad" : "Hoppa över denna månad"}
                  aria-label={isSkippedThisMonth ? "Ångra skip denna månad" : "Hoppa över denna månad"}
                >
                  <CalendarOff className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rt)} aria-label="Redigera">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(rt.id)} aria-label="Ta bort">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-5">
            {shared.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Gemensamma · {shared.length}
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {sumActive(shared).toLocaleString("sv-SE")} kr/mån
                  </span>
                </div>
                <div className="space-y-2">{shared.map(renderRow)}</div>
              </div>
            )}

            {privates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Mina privata · {privates.length}
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {sumActive(privates).toLocaleString("sv-SE")} kr/mån
                  </span>
                </div>
                <div className="space-y-2">{privates.map(renderRow)}</div>
              </div>
            )}
          </div>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Redigera" : "Ny återkommande transaktion"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div role="group" aria-label="Typ" className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button onClick={() => setType("expense")} aria-pressed={type === "expense"}
                className={cn("py-2 rounded-lg text-sm font-medium transition", type === "expense" ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Utgift
              </button>
              <button onClick={() => setType("income")} aria-pressed={type === "income"}
                className={cn("py-2 rounded-lg text-sm font-medium transition", type === "income" ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Inkomst
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rt-desc">Beskrivning</Label>
              <Input id="rt-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="T.ex. Lön, Hyra, Spotify" className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rt-amount">Belopp (SEK)</Label>
                <NumericInput id="rt-amount" value={amount} onChange={setAmount} placeholder="0" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-day">Dag i månaden</Label>
                <Input id="rt-day" type="number" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} onFocus={e => e.target.select()} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rt-cat">Kategori</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="rt-cat" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.categories.map(c => (
                      <SelectItem key={c.id} value={c.id}><span className="mr-1">{c.icon}</span>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-payer">{type === "expense" ? "Betalare" : "Mottagare"}</Label>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger id="rt-payer" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.persons.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="rt-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="rt-active">Aktiv</Label>
            </div>

            {canBePrivate && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                <Switch
                  id="rt-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  aria-label="Markera som privat"
                />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="rt-private" className="flex items-center gap-1.5 cursor-pointer">
                    <Lock className="h-3.5 w-3.5" /> Privat
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Syns endast för dig — månadens auto-genererade transaktioner ärver flaggan.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Avbryt</Button>
            <Button onClick={save} className="bg-gradient-primary rounded-xl">{editing ? "Uppdatera" : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { sek, pct, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Trophy, LineChart as LineChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SavingsGoal } from "@/types/budget";
import { DatePicker } from "@/components/DatePicker";

const ICONS = ["🎯", "🗾", "🛡️", "🚗", "🏠", "✈️", "💍", "🎓", "🔨", "💻"];

export default function Goals() {
  const { state, dispatch } = useBudget();
  const [createOpen, setCreateOpen] = useState(false);
  const [contribFor, setContribFor] = useState<SavingsGoal | null>(null);
  const [snapshotFor, setSnapshotFor] = useState<SavingsGoal | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Sparmål</h1>
          <p className="text-sm text-muted-foreground mt-1">Spara mot drömmar – tillsammans.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-primary rounded-xl"><Plus className="h-4 w-4" /> Nytt mål</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {state.goals.map(g => {
          const ratio = Math.min(1, g.saved / g.target);
          // Forecast based on contributions — use Math.min to find oldest date regardless of array sort order
          const oldestContribMs = g.contributions.length
            ? Math.min(...g.contributions.map(c => new Date(c.date).getTime()))
            : Date.now();
          const monthsActive = Math.max(1, Math.ceil((Date.now() - oldestContribMs) / (30 * 86400000)));
          const avgPerMonth = g.contributions.reduce((s, c) => s + c.amount, 0) / monthsActive;
          const remaining = Math.max(0, g.target - g.saved);
          const monthsLeft = avgPerMonth > 0 ? Math.ceil(remaining / avgPerMonth) : null;
          const forecast = monthsLeft != null
            ? new Date(Date.now() + monthsLeft * 30 * 86400000)
            : null;
          const milestones = [0.25, 0.5, 0.75, 1];
          const byPerson = g.contributions.reduce<Record<string, number>>((acc, c) => {
            if (!c.personId) return acc;
            acc[c.personId] = (acc[c.personId] ?? 0) + c.amount;
            return acc;
          }, {});
          const personTotals = state.persons
            .map(p => ({ person: p, total: byPerson[p.id] ?? 0 }))
            .filter(x => x.total > 0);
          const totalFromPersons = personTotals.reduce((s, x) => s + x.total, 0);
          return (
            <Card key={g.id} className="p-6 rounded-2xl shadow-soft border-0 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">{g.icon}</div>
                  <div>
                    <div className="font-display font-semibold text-lg">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{sek(g.saved)} av {sek(g.target)}</div>
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => setDeleteGoalId(g.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{pct(ratio)}</span>
                  <span className="text-muted-foreground">{sek(remaining)} kvar</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-success rounded-full transition-all" style={{ width: `${ratio * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  {milestones.map(m => (
                    <span key={m} className={cn("flex items-center gap-1", ratio >= m && "text-success font-bold")}>
                      {ratio >= m && <Trophy className="h-3 w-3" />}{Math.round(m * 100)}%
                    </span>
                  ))}
                </div>
              </div>

              {personTotals.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Bidrag</div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted" aria-label="Fördelning av bidrag per person">
                    {personTotals.map(({ person, total }) => (
                      <div
                        key={person.id}
                        style={{ width: `${(total / totalFromPersons) * 100}%`, background: person.color }}
                        aria-label={`${person.name}: ${sek(total)}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {personTotals.map(({ person, total }) => (
                      <div key={person.id} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: person.color }} aria-hidden="true" />
                        <span className="font-medium">{person.name}</span>
                        <span className="text-muted-foreground tabular-nums">{sek(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(g.snapshots ?? []).length >= 2 && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Saldoutveckling</span>
                    <span className="text-muted-foreground tabular-nums">
                      {sek((g.snapshots ?? [])[0]?.balance ?? 0)} senast
                    </span>
                  </div>
                  <Sparkline snapshots={g.snapshots ?? []} />
                </div>
              )}

              <div className="mt-5 flex items-center justify-between text-sm gap-2">
                <div className="text-muted-foreground text-xs sm:text-sm flex-1 min-w-0 truncate">
                  {forecast ? (
                    <>Prognos: <span className="text-foreground font-medium">{forecast.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}</span></>
                  ) : "Lägg till sparande för prognos"}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setSnapshotFor(g)} title="Uppdatera saldo">
                    <LineChartIcon className="h-3 w-3" /> Saldo
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setContribFor(g)}>
                    <Plus className="h-3 w-3" /> Sparande
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {state.goals.length === 0 && (
          <Card className="md:col-span-2 p-10 text-center text-muted-foreground rounded-2xl">Inga sparmål än. Skapa ditt första!</Card>
        )}
      </div>

      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContribDialog goal={contribFor} onClose={() => setContribFor(null)} />
      <SnapshotDialog goal={snapshotFor} onClose={() => setSnapshotFor(null)} />

      <AlertDialog open={!!deleteGoalId} onOpenChange={open => { if (!open) setDeleteGoalId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort sparmål?</AlertDialogTitle>
            <AlertDialogDescription>
              Alla bidrag och saldohistorik för detta mål raderas permanent och kan inte återställas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteGoalId) return;
                dispatch({ type: "DELETE_GOAL", goalId: deleteGoalId });
                toast.success("Mål borttaget");
                setDeleteGoalId(null);
              }}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { dispatch } = useBudget();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [date, setDate] = useState("");

  const submit = () => {
    const t = parseFloat(target.replace(",", "."));
    if (!name.trim() || !t) { toast.error("Fyll i namn och målsumma"); return; }
    dispatch({
      type: "UPSERT_GOAL",
      goal: {
        id: Math.random().toString(36).slice(2, 10),
        name: name.trim(), icon, target: t, saved: 0,
        targetDate: date ? new Date(date).toISOString() : undefined,
        contributions: [],
        snapshots: [],
      },
    });
    toast.success("Sparmål skapat");
    setName(""); setTarget(""); setDate(""); setIcon("🎯");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display text-xl">Nytt sparmål</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ikon</Label>
            <div className="flex flex-wrap gap-1">
              {ICONS.map(i => (
                <button key={i} onClick={() => setIcon(i)} className={cn("h-10 w-10 rounded-xl text-xl flex items-center justify-center transition", icon === i ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>{i}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2"><Label>Namn</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Resa till Italien" className="rounded-xl" /></div>
          <div className="space-y-2"><Label>Målsumma (SEK)</Label><Input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} onFocus={e => e.target.select()} placeholder="50000" className="rounded-xl" /></div>
          <div className="space-y-2"><Label>Måldatum (valfritt)</Label><DatePicker value={date} onChange={setDate} placeholder="Välj måldatum" className="rounded-xl" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary rounded-xl">Skapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContribDialog({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const defaultPersonId = useMemo(() => {
    const match = state.persons.find(p => p.id === user?.id);
    return match?.id ?? state.persons[0]?.id ?? "";
  }, [state.persons, user?.id]);
  const [amount, setAmount] = useState("");
  const [personId, setPersonId] = useState(defaultPersonId);

  // Reset person when dialog reopens
  useEffect(() => { if (goal) setPersonId(defaultPersonId); }, [goal, defaultPersonId]);

  const personById = useMemo(
    () => Object.fromEntries(state.persons.map(p => [p.id, p])),
    [state.persons],
  );

  const submit = () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!n || !goal || !personId) return;
    dispatch({ type: "ADD_GOAL_CONTRIB", goalId: goal.id, amount: n, personId });
    const who = personById[personId]?.name ?? "";
    toast.success(`+${sek(n)} till ${goal.name}${who ? ` · ${who}` : ""}`);
    setAmount(""); onClose();
  };

  return (
    <Dialog open={!!goal} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display">{goal?.icon} {goal?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contrib-amount">Belopp att lägga till</Label>
            <Input id="contrib-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} placeholder="2000" className="text-2xl h-14 font-display font-bold rounded-xl" autoFocus />
          </div>

          {state.persons.length > 1 && (
            <div className="space-y-2">
              <Label>Vem bidrog?</Label>
              <div role="radiogroup" aria-label="Vem bidrog" className="grid grid-cols-2 gap-2">
                {state.persons.map(p => {
                  const selected = personId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPersonId(p.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: p.color }}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {goal && goal.contributions.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-auto pt-1">
              {goal.contributions.slice(0, 5).map(c => {
                const who = personById[c.personId]?.name;
                return (
                  <div key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{dateLabel(c.date)}{who ? ` · ${who}` : ""}</span>
                    <span className="tabular-nums">+{sek(c.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button onClick={submit} disabled={!amount || !personId} className="bg-gradient-primary rounded-xl">Lägg till</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Sparkline({ snapshots }: { snapshots: SavingsGoal["snapshots"] }) {
  // snapshots are stored newest-first; chart needs oldest-first
  const points = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots],
  );
  if (points.length < 2) return null;

  const w = 100;
  const h = 28;
  const min = Math.min(...points.map(p => p.balance));
  const max = Math.max(...points.map(p => p.balance));
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.balance - min) / range) * (h - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const last = points[points.length - 1];
  const first = points[0];
  const trendUp = last.balance >= first.balance;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-7"
      role="img"
      aria-label={`Saldoutveckling från ${sek(first.balance)} till ${sek(last.balance)}`}
    >
      <polyline
        fill="none"
        stroke={trendUp ? "hsl(var(--success))" : "hsl(var(--destructive))"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

function SnapshotDialog({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const { dispatch } = useBudget();
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (goal) {
      setBalance(String(goal.saved));
      setDate(new Date().toISOString().split("T")[0]);
      setNote("");
    }
  }, [goal]);

  const submit = () => {
    const n = parseFloat(balance.replace(",", "."));
    if (isNaN(n) || n < 0 || !goal || !date) {
      toast.error("Ange ett giltigt saldo och datum");
      return;
    }
    dispatch({ type: "ADD_GOAL_SNAPSHOT", goalId: goal.id, balance: n, date, note: note.trim() });
    toast.success(`Saldo uppdaterat till ${sek(n)}`);
    onClose();
  };

  const snapshots = goal?.snapshots ?? [];

  return (
    <Dialog open={!!goal} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{goal?.icon} Uppdatera saldo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Stäm av mot ditt riktiga konto (t.ex. Avanza). Saldot ersätter målets nuvarande värde.
          </p>
          <div className="space-y-2">
            <Label htmlFor="snap-balance">Saldo (SEK)</Label>
            <Input
              id="snap-balance"
              inputMode="decimal"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              onFocus={e => e.target.select()}
              className="text-2xl h-14 font-display font-bold rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snap-date">Datum</Label>
            <DatePicker value={date} onChange={setDate} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snap-note">Anteckning (valfritt)</Label>
            <Input
              id="snap-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="T.ex. Avstämt mot Avanza"
              className="rounded-xl"
            />
          </div>

          {snapshots.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Historik</div>
              <ul className="space-y-1.5 max-h-32 overflow-auto">
                {snapshots.slice(0, 8).map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground">{dateLabel(s.date)}</span>
                      {s.note && <span className="ml-2 text-muted-foreground/80 truncate">· {s.note}</span>}
                    </div>
                    <span className="tabular-nums font-medium">{sek(s.balance)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!goal) return;
                        dispatch({ type: "DELETE_GOAL_SNAPSHOT", goalId: goal.id, snapshotId: s.id });
                        toast.success("Snapshot borttagen");
                      }}
                      aria-label="Ta bort snapshot"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button onClick={submit} disabled={!balance || !date} className="bg-gradient-primary rounded-xl">Spara saldo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

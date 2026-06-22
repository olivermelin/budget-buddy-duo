import { useEffect, useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { sek, pct, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Trophy, LineChart as LineChartIcon, Users, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SavingsGoal } from "@/types/budget";
import { DatePicker } from "@/components/DatePicker";

const ICONS = ["🎯", "🗾", "🛡️", "🚗", "🏠", "✈️", "💍", "🎓", "🔨", "💻"];

type OwnerFilter = "all" | "shared" | string; // string = person id

export default function Goals() {
  const { state, dispatch } = useBudget();
  const [createOpen, setCreateOpen] = useState(false);
  const [contribFor, setContribFor] = useState<SavingsGoal | null>(null);
  const [snapshotFor, setSnapshotFor] = useState<SavingsGoal | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OwnerFilter>("all");

  const personById = useMemo(
    () => Object.fromEntries(state.persons.map(p => [p.id, p])),
    [state.persons],
  );

  const filteredGoals = useMemo(() => {
    if (filter === "all") return state.goals;
    if (filter === "shared") return state.goals.filter(g => !g.ownerId);
    return state.goals.filter(g => g.ownerId === filter);
  }, [state.goals, filter]);

  const ownerLabel = (g: SavingsGoal) => {
    if (!g.ownerId) return "Gemensamt";
    return personById[g.ownerId]?.name ?? "Okänd";
  };

  const ownerColor = (g: SavingsGoal) => {
    if (!g.ownerId) return undefined;
    return personById[g.ownerId]?.color;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Sparmål</h1>
          <p className="text-sm text-muted-foreground mt-1">Spara mot drömmar – tillsammans och var för sig.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-primary rounded-xl"><Plus className="h-4 w-4" /> Nytt mål</Button>
      </div>

      {/* Filter tabs */}
      {state.persons.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-xl w-fit">
          <button
            onClick={() => setFilter("all")}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition", filter === "all" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")}
          >Alla</button>
          {state.persons.map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition", filter === p.id ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")}
            >
              <span className="h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white" style={{ background: p.color }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setFilter("shared")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition", filter === "shared" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")}
          >
            <Users className="h-3.5 w-3.5" />
            Gemensamt
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {filteredGoals.map(g => {
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
          const deadlineStatus = (() => {
            if (!g.targetDate || remaining <= 0) return null;
            const deadlineDate = new Date(g.targetDate);
            const msToDeadline = deadlineDate.getTime() - Date.now();
            const monthsToDeadline = msToDeadline / (30 * 86400000);
            if (monthsToDeadline <= 0) {
              return { status: "late" as const, deadlineDate, neededPerMonth: 0 };
            }
            const neededPerMonth = remaining / monthsToDeadline;
            let status: "on-track" | "at-risk" | "off-track";
            if (avgPerMonth >= neededPerMonth) status = "on-track";
            else if (avgPerMonth >= neededPerMonth * 0.8) status = "at-risk";
            else status = "off-track";
            return { status, deadlineDate, neededPerMonth };
          })();
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
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-lg">{g.name}</span>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {ownerColor(g) ? (
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ownerColor(g) }} />
                        ) : (
                          <Users className="h-2.5 w-2.5" />
                        )}
                        {ownerLabel(g)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{sek(g.saved)} av {sek(g.target)}</div>
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  aria-label={`Ta bort ${g.name}`}
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

              {deadlineStatus && (
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground flex-1 min-w-0">
                    Deadline:{" "}
                    <span className="text-foreground font-medium">
                      {deadlineStatus.deadlineDate.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </span>
                  {deadlineStatus.status === "late" && <Badge variant="destructive" className="text-[10px] h-4 px-1.5 py-0 shrink-0">Försenat</Badge>}
                  {deadlineStatus.status === "on-track" && <Badge className="text-[10px] h-4 px-1.5 py-0 shrink-0 bg-green-100 text-green-700 hover:bg-green-100 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">På spår</Badge>}
                  {deadlineStatus.status === "at-risk" && <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 shrink-0 border-amber-400 text-amber-600 dark:text-amber-400">Risk</Badge>}
                  {deadlineStatus.status === "off-track" && <Badge variant="destructive" className="text-[10px] h-4 px-1.5 py-0 shrink-0">Ur spår</Badge>}
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
        {filteredGoals.length === 0 && (
          <Card className="md:col-span-2 p-10 text-center text-muted-foreground rounded-2xl">
            {state.goals.length === 0 ? "Inga sparmål än. Skapa ditt första!" : "Inga mål matchar filtret."}
          </Card>
        )}
      </div>

      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContribDialog goal={contribFor} onClose={() => setContribFor(null)} />
      <SnapshotDialog goal={snapshotFor} onClose={() => setSnapshotFor(null)} />

      <ConfirmDialog
        open={!!deleteGoalId}
        onOpenChange={open => { if (!open) setDeleteGoalId(null); }}
        title="Ta bort sparmål?"
        description="Alla bidrag och saldohistorik för detta mål raderas permanent och kan inte återställas."
        onConfirm={() => {
          if (!deleteGoalId) return;
          dispatch({ type: "DELETE_GOAL", goalId: deleteGoalId });
          toast.success("Mål borttaget");
          setDeleteGoalId(null);
        }}
      />
    </div>
  );
}

function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [target, setTarget] = useState(0);
  const [icon, setIcon] = useState("🎯");
  const [date, setDate] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null); // null = gemensamt
  const [monthlyContribution, setMonthlyContribution] = useState(0);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(""); setTarget(0); setDate(""); setIcon("🎯");
      setOwnerId(null); setMonthlyContribution(0);
    }
  }, [open]);

  const submit = () => {
    const t = target;
    if (!name.trim() || !t) { toast.error("Fyll i namn och målsumma"); return; }
    dispatch({
      type: "UPSERT_GOAL",
      goal: {
        id: crypto.randomUUID(),
        name: name.trim(), icon, target: t, saved: 0,
        targetDate: date ? new Date(date).toISOString() : undefined,
        ownerId,
        monthlyContribution: monthlyContribution > 0 ? monthlyContribution : undefined,
        contributions: [],
        snapshots: [],
      },
    });
    toast.success("Sparmål skapat");
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
          <div className="space-y-2"><Label>Målsumma (SEK)</Label><NumericInput value={target} onChange={setTarget} placeholder="50 000" className="rounded-xl" /></div>
          <div className="space-y-2">
            <Label>Månadssparande (SEK)</Label>
            <NumericInput value={monthlyContribution} onChange={setMonthlyContribution} placeholder="0 = manuellt" className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Läggs automatiskt till sparmålet varje månad.</p>
          </div>
          <div className="space-y-2"><Label>Måldatum (valfritt)</Label><DatePicker value={date} onChange={setDate} placeholder="Välj måldatum" className="rounded-xl" /></div>

          {/* Owner selector */}
          {state.persons.length > 1 && (
            <div className="space-y-2">
              <Label>Vems mål?</Label>
              <div role="radiogroup" aria-label="Vems mål" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${state.persons.length + 1}, minmax(0, 1fr))` }}>
                {state.persons.map(p => {
                  const selected = ownerId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setOwnerId(p.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition",
                        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: p.color }}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium truncate max-w-full">{p.name}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={ownerId === null}
                  onClick={() => setOwnerId(null)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition",
                    ownerId === null ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center bg-muted">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <span className="font-medium">Gemensamt</span>
                </button>
              </div>
            </div>
          )}
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
  const [amount, setAmount] = useState(0);
  const [personId, setPersonId] = useState(defaultPersonId);

  // Reset person when dialog reopens
  useEffect(() => { if (goal) setPersonId(defaultPersonId); }, [goal, defaultPersonId]);

  const personById = useMemo(
    () => Object.fromEntries(state.persons.map(p => [p.id, p])),
    [state.persons],
  );

  const submit = () => {
    const n = amount;
    if (!n || !goal || !personId) return;
    dispatch({ type: "ADD_GOAL_CONTRIB", goalId: goal.id, amount: n, personId });
    const who = personById[personId]?.name ?? "";
    toast.success(`+${sek(n)} till ${goal.name}${who ? ` · ${who}` : ""}`);
    setAmount(0); onClose();
  };

  return (
    <Dialog open={!!goal} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display">{goal?.icon} {goal?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contrib-amount">Belopp att lägga till</Label>
            <NumericInput id="contrib-amount" value={amount} onChange={setAmount} placeholder="2 000" className="text-2xl h-14 font-display font-bold rounded-xl" autoFocus />
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
            <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto pr-1 pt-1">
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
          <Button onClick={submit} disabled={amount <= 0 || !personId} className="bg-gradient-primary rounded-xl">Lägg till</Button>
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
  const [balance, setBalance] = useState(0);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (goal) {
      setBalance(goal.saved);
      setDate(new Date().toISOString().split("T")[0]);
      setNote("");
    }
  }, [goal]);

  const submit = () => {
    const n = balance;
    if (n < 0 || !goal || !date) {
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
            <NumericInput
              id="snap-balance"
              value={balance}
              onChange={setBalance}
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
              <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
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
                      className="text-muted-foreground hover:text-destructive shrink-0 p-2 -m-2 rounded"
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

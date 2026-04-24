import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { sek, pct, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SavingsGoal } from "@/types/budget";

const ICONS = ["🎯", "🗾", "🛡️", "🚗", "🏠", "✈️", "💍", "🎓", "🔨", "💻"];

export default function Goals() {
  const { state, dispatch } = useBudget();
  const [createOpen, setCreateOpen] = useState(false);
  const [contribFor, setContribFor] = useState<SavingsGoal | null>(null);

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
          // Forecast based on contributions
          const monthsActive = Math.max(1, g.contributions.length ? Math.ceil((Date.now() - new Date(g.contributions[g.contributions.length - 1].date).getTime()) / (30 * 86400000)) : 1);
          const avgPerMonth = g.contributions.reduce((s, c) => s + c.amount, 0) / monthsActive;
          const remaining = Math.max(0, g.target - g.saved);
          const monthsLeft = avgPerMonth > 0 ? Math.ceil(remaining / avgPerMonth) : null;
          const forecast = monthsLeft != null
            ? new Date(Date.now() + monthsLeft * 30 * 86400000)
            : null;
          const milestones = [0.25, 0.5, 0.75, 1];
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
                  onClick={() => { dispatch({ type: "DELETE_GOAL", goalId: g.id }); toast.success("Mål borttaget"); }}
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

              <div className="mt-5 flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  {forecast ? (
                    <>Prognos: <span className="text-foreground font-medium">{forecast.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}</span></>
                  ) : "Lägg till sparande för prognos"}
                </div>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setContribFor(g)}>
                  <Plus className="h-3 w-3" /> Sparande
                </Button>
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
          <div className="space-y-2"><Label>Målsumma (SEK)</Label><Input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} placeholder="50000" className="rounded-xl" /></div>
          <div className="space-y-2"><Label>Måldatum (valfritt)</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl" /></div>
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
  const { dispatch } = useBudget();
  const [amount, setAmount] = useState("");
  const submit = () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!n || !goal) return;
    dispatch({ type: "ADD_GOAL_CONTRIB", goalId: goal.id, amount: n });
    toast.success(`+${sek(n)} till ${goal.name}`);
    setAmount(""); onClose();
  };
  return (
    <Dialog open={!!goal} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display">{goal?.icon} {goal?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Belopp att lägga till</Label>
          <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2000" className="text-2xl h-14 font-display font-bold rounded-xl" autoFocus />
          {goal && goal.contributions.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-auto">
              {goal.contributions.slice(0, 5).map(c => (
                <div key={c.id} className="flex justify-between"><span>{dateLabel(c.date)}</span><span>+{sek(c.amount)}</span></div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary rounded-xl">Lägg till</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

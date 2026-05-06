import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { summarizeMonth, computeEffectiveBudgets } from "@/lib/analytics";
import { sek, pct, monthLabel, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Budget() {
  const { state } = useBudget();
  const [offset, setOffset] = useState(0);
  const ref = new Date();
  const monthDate = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  const summary = useMemo(() => summarizeMonth(state, monthDate.getFullYear(), monthDate.getMonth()), [state, offset]);
  const effectiveBudgets = useMemo(() => computeEffectiveBudgets(state), [state]);
  const [drillId, setDrillId] = useState<string | null>(null);

  const totalBudget = state.categories.reduce((s, c) => s + (effectiveBudgets[c.id] ?? c.budget), 0);
  const totalSpent = state.categories.reduce((s, c) => s + (summary.byCategory[c.id] || 0), 0);

  const drillCat = drillId ? state.categories.find(c => c.id === drillId) : null;
  const drillTxs = drillCat
    ? state.transactions
        .filter(t => t.type === "expense" && t.categoryId === drillCat.id)
        .filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
        })
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const personMap = Object.fromEntries(state.persons.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Budget</h1>
          <p className="text-sm text-muted-foreground mt-1">Följ era kategorier månadsvis.</p>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl border p-1 shadow-soft">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-2 min-w-[140px] text-center capitalize">{monthLabel(monthDate)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
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
        {state.categories.map(c => {
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
                  <div className="font-medium truncate">{t.description}</div>
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

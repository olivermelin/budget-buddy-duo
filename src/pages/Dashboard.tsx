import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { lastNMonths, summarizeMonth, buildMonthPlan } from "@/lib/analytics";
import { sek, pct, monthLabel, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Plus, Sparkles, TrendingDown, TrendingUp, Wallet, PiggyBank, Receipt, Home, Landmark, CalendarCheck } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { state } = useBudget();
  const [open, setOpen] = useState(false);
  const today = new Date();

  const cur = useMemo(() => summarizeMonth(state, today.getFullYear(), today.getMonth()), [state]);
  const prevDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), []);
  const prev = useMemo(() => summarizeMonth(state, prevDate.getFullYear(), prevDate.getMonth()), [state]);
  const plan = useMemo(() => buildMonthPlan(state, today.getFullYear(), today.getMonth()), [state]);

  const recent = useMemo(() => state.transactions.slice(0, 5), [state.transactions]);
  const catMap = useMemo(() => Object.fromEntries(state.categories.map(c => [c.id, c])), [state.categories]);
  const personMap = useMemo(() => Object.fromEntries(state.persons.map(p => [p.id, p])), [state.persons]);

  const insights = useMemo(() => {
    const out: { label: string; tone: "good" | "warn" | "info" }[] = [];
    // Food spending
    const curFood = cur.byCategory["mat"] || 0;
    const prevFood = prev.byCategory["mat"] || 0;
    if (prevFood > 0) {
      const diff = (curFood - prevFood) / prevFood;
      if (Math.abs(diff) > 0.05) {
        out.push({
          label: diff < 0
            ? `Ni har spenderat ${pct(Math.abs(diff))} mindre på mat denna månad`
            : `Matutgifter ${pct(diff)} högre än förra månaden`,
          tone: diff < 0 ? "good" : "warn",
        });
      }
    }
    // Goal progress
    const top = [...state.goals].sort((a, b) => b.saved / b.target - a.saved / a.target)[0];
    if (top) {
      out.push({ label: `${top.icon} ${top.name} – ${pct(top.saved / top.target)} av målet`, tone: "info" });
    }
    // Budget warnings
    for (const c of state.categories) {
      const spent = cur.byCategory[c.id] || 0;
      if (c.budget && spent / c.budget > 1) {
        out.push({ label: `${c.icon} ${c.name} har överskridit budgeten`, tone: "warn" });
        break;
      }
    }
    if (cur.remaining > prev.remaining && prev.remaining > 0) {
      out.push({ label: `Ni har ${sek(cur.remaining - prev.remaining)} mer kvar än förra månaden`, tone: "good" });
    }
    return out.slice(0, 3);
  }, [cur, prev, state.categories, state.goals]);

  const trend = useMemo(() => {
    if (prev.remaining === 0) return 0;
    return (cur.remaining - prev.remaining) / Math.abs(prev.remaining);
  }, [cur, prev]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{monthLabel(today)}</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold mt-1">Hej {state.persons[0]?.name ?? "där"} <span aria-hidden="true">👋</span></h1>
        </div>
        <Button onClick={() => setOpen(true)} className="hidden md:inline-flex bg-gradient-primary rounded-xl shadow-soft">
          <Plus className="h-4 w-4" /> Lägg till utgift
        </Button>
      </div>

      {/* Hero card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-hero text-white p-6 md:p-10 rounded-3xl shadow-elegant animate-in-up">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-wider opacity-80">Kvar att leva på</p>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl md:text-6xl font-display font-extrabold tracking-tight">{sek(cur.remaining)}</span>
            {prev.remaining !== 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full",
                trend >= 0 ? "bg-success/20 text-white" : "bg-destructive/20 text-white"
              )}>
                {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {pct(Math.abs(trend))} mot förra månaden
              </span>
            )}
          </div>
          <p className="mt-3 text-sm opacity-80 max-w-md">
            Av {sek(cur.income)} i inkomster har {sek(cur.expenses)} gått till utgifter.
          </p>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={<ArrowDown className="h-4 w-4" />} label="Inkomster" value={sek(cur.income)} tone="success" />
        <Kpi icon={<Home className="h-4 w-4" />} label="Fasta utgifter" value={sek(cur.fixed)} tone="muted" />
        <Kpi icon={<Receipt className="h-4 w-4" />} label="Rörliga utgifter" value={sek(cur.variable)} tone="muted" />
        <Kpi icon={<PiggyBank className="h-4 w-4" />} label="Sparande" value={sek(cur.savings)} tone="primary" />
      </div>

      {/* Månadsplan */}
      {plan.hasRecurring && (
        <Card className="p-5 md:p-6 rounded-2xl border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Månadsplan</h2>
            <span className="ml-auto text-xs text-muted-foreground capitalize">{monthLabel(today)}</span>
          </div>

          <div className="space-y-3">
            {/* Inkomster */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success inline-block" />
                Planerade inkomster
              </span>
              <span className="font-medium text-success tabular-nums">+{sek(plan.plannedIncome)}</span>
            </div>

            {/* Fasta utgifter */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />
                Fasta utgifter
              </span>
              <span className="font-medium tabular-nums">−{sek(plan.plannedFixed)}</span>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed" />

            {/* Rörligt att spendera */}
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Rörligt att spendera</span>
              <span className="tabular-nums">{sek(plan.plannedFreeToSpend)}</span>
            </div>

            {/* Progress bar för rörliga utgifter */}
            {plan.plannedFreeToSpend > 0 && (
              <div className="space-y-1.5">
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      plan.spendPercent > 0.9 ? "bg-destructive" : plan.spendPercent > 0.7 ? "bg-warning" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(plan.spendPercent * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Spenderat: {sek(plan.actualVariable)} ({pct(plan.spendPercent)})</span>
                  <span className={cn(plan.remaining < 0 ? "text-destructive font-medium" : "")}>
                    {plan.remaining >= 0 ? `Kvar: ${sek(plan.remaining)}` : `Överskridet: ${sek(Math.abs(plan.remaining))}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Net worth */}
      {(state.goals.length > 0 || state.loans.length > 0) && (() => {
        const assets = state.goals.reduce((s, g) => s + g.saved, 0);
        const debts = state.loans.reduce((s, l) => s + l.currentBalance, 0);
        const net = assets - debts;
        return (
          <Card className="p-5 md:p-6 rounded-2xl border-0 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Nettoförmögenhet</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <div className="text-xs text-muted-foreground">Tillgångar</div>
                <div className="font-display font-bold text-lg md:text-xl tabular-nums text-success">{sek(assets)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Skulder</div>
                <div className="font-display font-bold text-lg md:text-xl tabular-nums text-destructive">−{sek(debts)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Netto</div>
                <div className={cn("font-display font-extrabold text-2xl md:text-3xl tabular-nums", net >= 0 ? "text-foreground" : "text-destructive")}>
                  {sek(net)}
                </div>
              </div>
            </div>
            {(assets + debts) > 0 && (
              <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden flex">
                <div className="h-full bg-success" style={{ width: `${(assets / (assets + debts)) * 100}%` }} />
                <div className="h-full bg-destructive" style={{ width: `${(debts / (assets + debts)) * 100}%` }} />
              </div>
            )}
          </Card>
        );
      })()}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Smarta insikter</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {insights.map((ins, i) => (
              <Card key={i} className={cn(
                "p-4 rounded-2xl border-0 shadow-soft",
                ins.tone === "good" && "bg-success-soft",
                ins.tone === "warn" && "bg-warning-soft",
                ins.tone === "info" && "bg-accent",
              )}>
                <p className="text-sm font-medium text-balance">{ins.label}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold">Senaste transaktioner</h2>
          <Link to="/transaktioner" className="text-sm text-primary hover:underline" aria-label="Visa alla transaktioner">Visa alla <span aria-hidden="true">→</span></Link>
        </div>
        <Card className="rounded-2xl shadow-soft overflow-hidden divide-y divide-border">
          {recent.length === 0 && <div className="p-6 text-sm text-muted-foreground">Inga transaktioner än.</div>}
          {recent.map(t => {
            const c = catMap[t.categoryId];
            const p = personMap[t.payerId];
            return (
              <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition">
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
              </div>
            );
          })}
        </Card>
      </div>

      <TransactionModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "muted" | "primary" }) {
  return (
    <Card className="p-4 md:p-5 rounded-2xl shadow-soft border-0 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          tone === "success" && "bg-success-soft text-success",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "muted" && "bg-muted text-foreground",
        )}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl md:text-2xl font-display font-bold tabular-nums">{value}</div>
    </Card>
  );
}

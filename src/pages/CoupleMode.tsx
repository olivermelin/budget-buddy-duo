import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBudget } from "@/store/budget-store";
import { calcSplit, calcCumulativeSplit, inMonth, isFixedExpense, Settlement } from "@/lib/analytics";
import { sek, monthLabel, periodLabel, pct, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ArrowRight, Home, Receipt, Lock, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TransactionModal } from "@/components/TransactionModal";
import { deleteTxWithUndo } from "@/lib/tx-actions";

export default function CoupleMode() {
  const { state, dispatch } = useBudget();
  const [offset, setOffset] = useState(0);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [breakdown, setBreakdown] = useState<"fixed" | "variable" | null>(null);
  const ref = new Date();
  const monthDate = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  const split = useMemo(() => calcSplit(state, monthDate.getFullYear(), monthDate.getMonth()), [state, offset]);
  const cumulative = useMemo(() => calcCumulativeSplit(state), [state]);

  const personById = useMemo(
    () => Object.fromEntries(state.persons.map(p => [p.id, p])),
    [state.persons],
  );
  const catMap = useMemo(
    () => Object.fromEntries(state.categories.map(c => [c.id, c])),
    [state.categories],
  );
  const fixedCatIds = useMemo(
    () => new Set(state.categories.filter(c => c.isFixed).map(c => c.id)),
    [state.categories],
  );
  const breakdownTxs = useMemo(() => {
    if (!breakdown) return [];
    return state.transactions.filter(t =>
      t.type === "expense" &&
      !t.isPrivate &&
      inMonth(t.date, monthDate.getFullYear(), monthDate.getMonth(), state.settings.payDay ?? 1) &&
      (breakdown === "fixed" ? isFixedExpense(t, fixedCatIds) : !isFixedExpense(t, fixedCatIds))
    ).sort((a, b) => b.date.localeCompare(a.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, state.transactions, monthDate, fixedCatIds]);

  const totalIncome = state.persons.reduce((s, p) => s + p.income, 0);
  const totalExpenses = split.fixedTotal + split.variableTotal;

  // Historik över registrerade avstämningar (settlement-transaktioner), senaste först.
  const settlementHistory = useMemo(
    () => state.transactions
      .filter(t => t.type === "settlement")
      .sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions],
  );

  // Privata utgifter denna månad (endast aktuell användares — RLS filtrerar bort sambons).
  const personalExpenses = useMemo(() => {
    let count = 0;
    let amount = 0;
    for (const t of state.transactions) {
      if (t.type !== "expense" || !t.isPrivate) continue;
      if (!inMonth(t.date, monthDate.getFullYear(), monthDate.getMonth(), state.settings.payDay ?? 1)) continue;
      count++;
      amount += t.amount;
    }
    return { count, amount };
  }, [state.transactions, monthDate]);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Hushållets fördelning</h1>
          <p className="text-sm text-muted-foreground mt-1">Rättvis fördelning av era utgifter.</p>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl border p-1 shadow-soft">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)} aria-label="Föregående månad">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3 min-w-[140px] text-center capitalize">{periodLabel(monthDate, state.settings.payDay ?? 1)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)} aria-label="Nästa månad">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {state.settings.splitMode === "income" && state.persons.some(p => p.income === 0) && (
        <Card className="px-4 py-3 rounded-xl border-0 shadow-soft bg-warning/10 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <div className="text-sm text-warning-foreground">
            {state.persons.filter(p => p.income === 0).map(p => p.name).join(", ")} har 0 kr i inkomst.
            {" "}Inkomstbaserad uppdelning fungerar inte korrekt — uppdatera inkomsten i{" "}
            <Link to="/settings" className="underline font-medium">Inställningar</Link>.
          </div>
        </Card>
      )}

      {personalExpenses.count > 0 && (
        <Card className="px-4 py-3 rounded-xl border-0 shadow-soft bg-muted/40 flex items-center gap-3">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            {personalExpenses.count === 1
              ? `1 privat utgift (${sek(personalExpenses.amount)}) ingår inte i uppdelningen.`
              : `${personalExpenses.count} privata utgifter (${sek(personalExpenses.amount)}) ingår inte i uppdelningen.`}
          </div>
        </Card>
      )}

      {/* Split mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(["50/50", "income"] as const).map(m => (
          <button
            key={m}
            onClick={() => dispatch({ type: "UPDATE_SETTINGS", patch: { splitMode: m } })}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition",
              state.settings.splitMode === m ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "50/50" ? "Lika delat" : "Efter inkomst"}
          </button>
        ))}
      </div>

      {/* Hero settlement card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-hero text-white p-6 md:p-10 rounded-3xl shadow-elegant animate-in-up">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest opacity-70 font-medium">Totalt utestående</p>
          {cumulative.settlements.length === 0 ? (
            <div className="mt-3">
              <p className="text-4xl md:text-5xl font-display font-extrabold">Ni är kvitt!</p>
              <p className="mt-2 text-sm opacity-70">Allt är utjämnat — ingen skuld finns kvar.</p>
            </div>
          ) : (
            <>
              <p className="text-5xl md:text-6xl font-display font-extrabold mt-3 tabular-nums tracking-tight">
                {sek(cumulative.settlements.reduce((s, x) => s + x.amount, 0))}
              </p>
              <p className="text-sm opacity-70 mt-1.5">
                {cumulative.settlements.length === 1 ? "1 överföring krävs" : `${cumulative.settlements.length} överföringar krävs`}
              </p>
              <ul className="mt-6 space-y-3">
                {cumulative.settlements.map((s, i) => {
                  const from = personById[s.from];
                  const to = personById[s.to];
                  if (!from || !to) return null;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-3 cursor-pointer p-2 rounded-lg transition hover:bg-white/10 active:bg-white/20"
                      onClick={() => setSelectedSettlement(s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedSettlement(s)}
                    >
                      <ColorAvatar name={from.name} color={from.color} />
                      <ArrowRight className="h-4 w-4 opacity-60 shrink-0" />
                      <ColorAvatar name={to.name} color={to.color} />
                      <span className="flex-1 text-sm opacity-90 ml-1">
                        <span className="font-semibold">{from.name}</span>
                        <span className="opacity-60 mx-1">betalar</span>
                        <span className="font-semibold">{to.name}</span>
                      </span>
                      <span className="font-display font-bold tabular-nums text-lg">{sek(s.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </Card>

      {state.persons.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">
          Inga personer i hushållet än.
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Utgiftsuppdelning */}
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="p-4 md:p-5 rounded-2xl shadow-soft border-0 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setBreakdown("fixed")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setBreakdown("fixed")}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <Home className="h-4 w-4" />
                </span>
                Fasta utgifter
              </div>
              <div className="text-2xl font-display font-bold tabular-nums">{sek(split.fixedTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {state.settings.splitMode === "50/50" ? "Delas lika" : "Delas efter inkomst"}
              </div>
              {totalExpenses > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(split.fixedTotal / totalExpenses) * 100}%` }} />
                </div>
              )}
            </Card>

            <Card
              className="p-4 md:p-5 rounded-2xl shadow-soft border-0 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setBreakdown("variable")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setBreakdown("variable")}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </span>
                Rörliga utgifter
              </div>
              <div className="text-2xl font-display font-bold tabular-nums">{sek(split.variableTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Delas alltid lika ({pct(1 / Math.max(1, state.persons.length))})
              </div>
              {totalExpenses > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/50" style={{ width: `${(split.variableTotal / totalExpenses) * 100}%` }} />
                </div>
              )}
            </Card>
          </div>

          {/* Personkort */}
          <div className="grid md:grid-cols-2 gap-4">
            {state.persons.map(p => {
              const paid = split.paid[p.id] ?? 0;
              const share = split.share[p.id] ?? 0;
              const diff = split.diff[p.id] ?? 0;
              const fixedShare = split.fixedShare[p.id] ?? 0;
              const variableShare = split.variableShare[p.id] ?? 0;
              const fixedPct = state.settings.splitMode === "50/50"
                ? 1 / Math.max(1, state.persons.length)
                : totalIncome > 0 ? p.income / totalIncome : 0;
              const paidPct = share > 0 ? Math.min(paid / share, 1) : 0;
              const isEven = Math.abs(diff) <= 0.5;
              const isAhead = diff > 0.5;

              return (
                <Card key={p.id} className="rounded-2xl shadow-soft border-0 overflow-hidden">
                  {/* Färgad toppkant */}
                  <div className="h-1.5 w-full" style={{ background: p.color }} />

                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <ColorAvatar name={p.name} color={p.color} size="lg" />
                      <div>
                        <div className="font-display font-bold text-xl">{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{sek(p.income)} / mån</div>
                      </div>
                      <div className={cn(
                        "ml-auto text-xs font-semibold px-2.5 py-1 rounded-full",
                        isEven ? "bg-muted text-muted-foreground"
                          : isAhead ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      )} aria-label={isEven ? "Jämnt" : isAhead ? `Ligger ute med ${sek(diff)}` : `Skyldig ${sek(-diff)}`}>
                        {isEven ? "Jämnt" : isAhead ? `+${sek(diff)}` : `−${sek(-diff)}`}
                      </div>
                    </div>

                    {/* Betalat vs andel — progress */}
                    <div className="mb-5 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Betalat</span>
                        <span>{sek(paid)} / {sek(share)}</span>
                      </div>
                      <div
                        className="h-2 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Math.round(paidPct * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${p.name} har betalat ${Math.round(paidPct * 100)}% av sin andel`}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${paidPct * 100}%`, background: p.color }}
                        />
                      </div>
                    </div>

                    {/* Andelsuppdelning */}
                    <div className="rounded-xl bg-muted/40 p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Home className="h-3.5 w-3.5" />
                          Fasta ({pct(fixedPct)})
                        </span>
                        <span className="font-medium tabular-nums">{sek(fixedShare)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5" />
                          Rörliga ({pct(1 / Math.max(1, state.persons.length))})
                        </span>
                        <span className="font-medium tabular-nums">{sek(variableShare)}</span>
                      </div>
                      <div className="border-t border-border/50 pt-3 flex items-center justify-between font-semibold">
                        <span>Total andel</span>
                        <span className="tabular-nums">{sek(share)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Avstämningshistorik */}
      <Card className="rounded-2xl shadow-soft border-0 overflow-hidden">
        <div className="p-5 md:p-6 pb-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Avstämningshistorik</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {settlementHistory.length === 0
                ? ""
                : settlementHistory.length === 1 ? "1 avstämning" : `${settlementHistory.length} avstämningar`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Registrerade överföringar mellan er.</p>
        </div>
        {settlementHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 md:px-6 pb-6">
            Inga avstämningar registrerade än. Klicka på en utestående överföring ovan för att registrera en betalning.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {settlementHistory.map(t => {
              const from = personById[t.payerId];
              const to = personById[t.receiverId ?? ""];
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 md:px-6 py-3 group">
                  {from && <ColorAvatar name={from.name} color={from.color} />}
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  {to && <ColorAvatar name={to.name} color={to.color} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      <span className="font-semibold">{from?.name ?? "Okänd"}</span>
                      <span className="text-muted-foreground mx-1">betalade</span>
                      <span className="font-semibold">{to?.name ?? "Okänd"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{dateLabel(t.date)}</div>
                  </div>
                  <span className="font-display font-bold tabular-nums text-sm shrink-0">{sek(t.amount)}</span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition shrink-0"
                    onClick={() => deleteTxWithUndo(t, dispatch)}
                    aria-label={`Ta bort avstämning ${from?.name ?? ""} → ${to?.name ?? ""}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={breakdown !== null} onOpenChange={v => !v && setBreakdown(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {breakdown === "fixed" ? "Fasta utgifter" : "Rörliga utgifter"} — {periodLabel(monthDate, state.settings.payDay ?? 1)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {breakdownTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Inga transaktioner denna månad.</p>
            ) : (
              <div className="divide-y divide-border">
                {breakdownTxs.map(t => {
                  const c = catMap[t.categoryId ?? ""];
                  const p = personById[t.payerId];
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-muted"
                      >{c?.icon ?? "📦"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{t.description}</div>
                        <div className="text-xs text-muted-foreground">{dateLabel(t.date)} · {p?.name} · {c?.name ?? "Okategoriserad"}</div>
                      </div>
                      <div className="font-display font-bold tabular-nums text-sm shrink-0">−{sek(t.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {breakdownTxs.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Totalt</span>
              <span className="font-display font-bold tabular-nums">−{sek(breakdownTxs.reduce((s, t) => s + t.amount, 0))}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedSettlement && (
        <TransactionModal
          open={true}
          onOpenChange={(v) => !v && setSelectedSettlement(null)}
          settlementMode={{
            from: selectedSettlement.from,
            to: selectedSettlement.to,
            amount: selectedSettlement.amount,
          }}
        />
      )}
    </div>
  );
}

function ColorAvatar({ name, color, size }: { name: string; color: string; size?: "lg" }) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-display font-bold text-white shrink-0",
        size === "lg" ? "h-11 w-11 text-base" : "h-8 w-8 text-sm"
      )}
      style={{ background: color }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

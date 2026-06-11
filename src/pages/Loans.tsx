import { useMemo, useState, useEffect } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { Loan, LoanType } from "@/types/budget";
import { sek, pct } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, TrendingDown, AlertTriangle, Banknote, Calendar, Sparkles, Repeat } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/MonthPicker";
import { ExtraAmortizationSimulator } from "@/components/ExtraAmortizationSimulator";

const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  mortgage: "Bolån",
  car: "Billån",
  student: "Studielån",
  personal: "Privatlån",
  credit_card: "Kreditkort",
  other: "Annat",
};

const LOAN_TYPE_ICON: Record<LoanType, string> = {
  mortgage: "🏠",
  car: "🚗",
  student: "🎓",
  personal: "💸",
  credit_card: "💳",
  other: "💰",
};

// Fast-amorteringsmodell: fast månadsamortering + rörlig ränta (standard för svenska bolån)
function monthsFixedAmort(balance: number, amortization: number): number | null {
  if (balance <= 0) return 0;
  if (amortization <= 0) return null;
  return Math.ceil(balance / amortization);
}

function totalInterestFixed(balance: number, amortization: number, annualRate: number): number {
  if (amortization <= 0) return Infinity;
  const r = annualRate / 100 / 12;
  const n = Math.ceil(balance / amortization);
  // Σ ränta = r × (n×B - amort × n(n-1)/2)
  return r * (n * balance - amortization * n * (n - 1) / 2);
}

function buildAmortizationSeriesFixed(balance: number, amortization: number, maxMonths = 720) {
  if (amortization <= 0) return [{ month: 0, balance }];
  const series: { month: number; balance: number }[] = [{ month: 0, balance }];
  let b = balance;
  for (let m = 1; m <= maxMonths && b > 0; m++) {
    b = Math.max(0, b - amortization);
    if (m % 12 === 0 || b <= 0) series.push({ month: m, balance: Math.round(b) });
  }
  return series;
}

// Annuitetsmodell (fallback för lån med fast totalbetaning, t.ex. billån)
function monthsToPayoff(balance: number, monthlyPayment: number, annualRate: number): number | null {
  if (balance <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (monthlyPayment <= balance * r) return null;
  if (r === 0) return Math.ceil(balance / monthlyPayment);
  const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r);
  return Math.ceil(n);
}

function totalInterest(balance: number, monthlyPayment: number, annualRate: number): number {
  const months = monthsToPayoff(balance, monthlyPayment, annualRate);
  if (months == null) return Infinity;
  return Math.max(0, months * monthlyPayment - balance);
}

function buildAmortizationSeries(balance: number, monthlyPayment: number, annualRate: number, maxMonths = 480) {
  const r = annualRate / 100 / 12;
  const series: { month: number; balance: number }[] = [{ month: 0, balance }];
  let b = balance;
  for (let m = 1; m <= maxMonths && b > 0; m++) {
    const interest = b * r;
    const principal = Math.max(0, monthlyPayment - interest);
    b = Math.max(0, b - principal);
    if (m % 6 === 0 || b <= 0) series.push({ month: m, balance: Math.round(b) });
    if (principal <= 0) break;
  }
  return series;
}

function dateInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "long" });
}

export default function Loans() {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Loan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Loan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shockRate, setShockRate] = useState<number | null>(null);

  // Only show shared loans + the current user's own private loans
  const visibleLoans = useMemo(() => {
    const uid = user?.id;
    return state.loans.filter(l => l.ownerId === null || l.ownerId === uid);
  }, [state.loans, user?.id]);

  const totals = useMemo(() => {
    const debt = visibleLoans.reduce((s, l) => s + l.currentBalance, 0);
    const original = visibleLoans.reduce((s, l) => s + l.originalAmount, 0);
    const monthly = visibleLoans.reduce((s, l) => s + l.monthlyPayment + (l.monthlyFee ?? 0), 0);
    const yearlyInterest = visibleLoans.reduce((s, l) => s + l.currentBalance * (l.interestRate / 100), 0);
    return { debt, original, monthly, yearlyInterest, paidOff: Math.max(0, original - debt) };
  }, [visibleLoans]);

  const debtFreeMonths = useMemo(() => {
    let max = 0;
    let possible = true;
    for (const l of visibleLoans) {
      const m = l.monthlyAmortization > 0
        ? monthsFixedAmort(l.currentBalance, l.monthlyAmortization)
        : monthsToPayoff(l.currentBalance, l.monthlyPayment, l.interestRate);
      if (m == null) { possible = false; break; }
      if (m > max) max = m;
    }
    return possible ? max : null;
  }, [visibleLoans]);

  const shockImpact = useMemo(() => {
    if (shockRate == null) return null;
    const newMonthly = visibleLoans.reduce((s, l) => {
      const newRate = shockRate;
      const r = newRate / 100 / 12;
      const principal = Math.max(0, l.monthlyPayment - l.currentBalance * (l.interestRate / 100 / 12));
      return s + principal + l.currentBalance * r;
    }, 0);
    return { newMonthly, diff: newMonthly - totals.monthly };
  }, [shockRate, visibleLoans, totals.monthly]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="loans" className="space-y-6">
        <TabsList className="rounded-xl">
          <TabsTrigger value="loans" className="rounded-lg">Mina lån</TabsTrigger>
          <TabsTrigger value="simulator" className="rounded-lg">Simulera</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-6 mt-0">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Lån & skulder</h1>
          <p className="text-sm text-muted-foreground mt-1">Följ era skulder, ränta och vägen till skuldfrihet.</p>
        </div>
        <Button onClick={() => { setEditing(null); setCreateOpen(true); }} className="bg-gradient-primary rounded-xl">
          <Plus className="h-4 w-4" /> Nytt lån
        </Button>
      </div>

      {visibleLoans.length === 0 ? (
        <Card className="p-10 rounded-2xl border-0 shadow-soft text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-4">💰</div>
          <h2 className="font-display font-semibold text-xl">Inga lån registrerade</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Lägg till bolån, billån, studielån eller andra skulder för att se total skuldsättning, ränta och när ni blir skuldfria.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-gradient-primary rounded-xl">
            <Plus className="h-4 w-4" /> Lägg till första lånet
          </Button>
        </Card>
      ) : (
        <>
          {/* Hero — total debt */}
          <Card className="relative overflow-hidden border-0 bg-gradient-hero text-white p-6 md:p-10 rounded-3xl shadow-elegant">
            <div aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-sm uppercase tracking-wider opacity-80">Total skuld</p>
              <div className="mt-3 text-5xl md:text-6xl font-display font-extrabold tabular-nums">{sek(totals.debt)}</div>
              <p className="mt-3 text-sm opacity-80">
                Avbetalat hittills: <span className="font-semibold">{sek(totals.paidOff)}</span>
                {totals.original > 0 && <> · {pct(totals.paidOff / totals.original)}</>}
              </p>
              {debtFreeMonths != null && debtFreeMonths > 0 && (
                <div className="mt-5 inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  Skuldfri {dateInMonths(debtFreeMonths)}
                </div>
              )}
            </div>
          </Card>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <Kpi label="Månadskostnad" value={sek(totals.monthly)} icon={<Banknote className="h-4 w-4" />} tone="primary" />
            <Kpi label="Ränta per år" value={sek(totals.yearlyInterest)} icon={<TrendingDown className="h-4 w-4" />} tone="warn" />
            <Kpi label="Antal lån" value={String(visibleLoans.length)} icon={<Sparkles className="h-4 w-4" />} tone="muted" />
          </div>

          {/* Loan cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {visibleLoans.map(l => {
              const ratio = l.originalAmount > 0 ? 1 - l.currentBalance / l.originalAmount : 0;
              const useFixed = l.monthlyAmortization > 0;
              const months = useFixed
                ? monthsFixedAmort(l.currentBalance, l.monthlyAmortization)
                : monthsToPayoff(l.currentBalance, l.monthlyPayment, l.interestRate);
              const interest = useFixed
                ? totalInterestFixed(l.currentBalance, l.monthlyAmortization, l.interestRate)
                : totalInterest(l.currentBalance, l.monthlyPayment, l.interestRate);
              const series = useFixed
                ? buildAmortizationSeriesFixed(l.currentBalance, l.monthlyAmortization)
                : buildAmortizationSeries(l.currentBalance, l.monthlyPayment, l.interestRate);

              // Tidsprogress från startDate + endDate
              const termTotal = (() => {
                if (!l.startDate || !l.endDate) return null;
                const s = new Date(l.startDate), e = new Date(l.endDate);
                return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
              })();
              const termPaid = (() => {
                if (!l.startDate) return null;
                const s = new Date(l.startDate), now = new Date();
                return Math.min(termTotal ?? Infinity, Math.max(0, (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth())));
              })();
              return (
                <Card key={l.id} className="p-5 rounded-2xl border-0 shadow-soft">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">{l.icon || LOAN_TYPE_ICON[l.type]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-semibold text-base leading-tight truncate">{l.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {LOAN_TYPE_LABEL[l.type]}{l.lender ? ` · ${l.lender}` : ""}
                        </div>
                        {/* Chip-rad: ränta, bindning, ägarskap */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                            {l.interestRate}% ränta
                          </span>
                          {l.rateFixedUntil && (() => {
                            const until = new Date(l.rateFixedUntil);
                            const now = new Date();
                            const ml = (until.getFullYear() - now.getFullYear()) * 12 + (until.getMonth() - now.getMonth());
                            const dateStr = until.toLocaleDateString("sv-SE", { year: "numeric", month: "short" });
                            if (ml < 0) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">⚠ Bindning utgången</span>;
                            if (ml <= 3) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-warning-soft text-warning">⚠ Bunden t.o.m. {dateStr}</span>;
                            return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">🔒 {dateStr}</span>;
                          })()}
                          {(() => {
                            const owner = l.ownerId ? state.persons.find(p => p.id === l.ownerId) : null;
                            if (owner) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">👤 {owner.name}</span>;
                            if (l.ownerId === null && state.persons.length > 1) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">🤝 {l.ownerShare}% / {100 - l.ownerShare}%</span>;
                            return null;
                          })()}
                          {l.lastGeneratedMonth === currentMonthKey && l.monthlyAmortization > 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              ✓ Amortering bokförd
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditing(l); setCreateOpen(true); }}>✎</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {/* Saldo + progress */}
                  <div className="mt-5">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="font-display font-bold text-2xl tabular-nums">{sek(l.currentBalance)}</span>
                      <span className="text-xs text-muted-foreground">av {sek(l.originalAmount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">{pct(ratio)} avbetalat</span>
                      {l.downPayment && l.downPayment > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Insats {sek(l.downPayment)} · LTV {Math.round(l.originalAmount / (l.originalAmount + l.downPayment) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tidsprogress (för lån med känd löptid) */}
                  {termTotal != null && termPaid != null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Månad <span className="font-semibold text-foreground">{termPaid}</span> av <span className="font-semibold text-foreground">{termTotal}</span></span>
                        <span>{termTotal - termPaid} månader kvar</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary/40 rounded-full" style={{ width: `${Math.min(100, (termPaid / termTotal) * 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Månadskostnad — lista istf boxar */}
                  {(() => {
                    const monthlyInterest = Math.round(l.currentBalance * l.interestRate / 100 / 12);
                    const monthlyPrincipal = l.monthlyAmortization > 0
                      ? l.monthlyAmortization
                      : Math.max(0, Math.round(l.monthlyPayment - monthlyInterest));
                    const fee = l.monthlyFee ?? 0;
                    const total = monthlyInterest + monthlyPrincipal + fee;
                    const rows = [
                      { label: "Räntekostnad", value: monthlyInterest },
                      { label: "Amortering", value: monthlyPrincipal },
                      ...(fee > 0 ? [{ label: "Månadsavgift", value: fee }] : []),
                    ];
                    return (
                      <div className="mt-4 rounded-xl border border-border/60 overflow-hidden">
                        {rows.map(r => (
                          <div key={r.label} className="flex justify-between items-center px-3 py-2 border-b border-border/40">
                            <span className="text-xs text-muted-foreground">{r.label}</span>
                            <span className="text-xs tabular-nums font-medium">{sek(r.value)}<span className="text-muted-foreground font-normal">/mån</span></span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center px-3 py-2.5 bg-muted/40 border-t border-border/60">
                          <span className="text-sm font-medium">Totalt / mån</span>
                          <span className="font-bold text-base tabular-nums">{sek(total)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Skuldfri + Total ränta */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground mb-0.5">Skuldfri</div>
                      <div className={cn("text-sm font-semibold tabular-nums", months == null && "text-destructive")}>
                        {months == null ? "Aldrig" : dateInMonths(months)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground mb-0.5">Total ränta</div>
                      <div className="text-sm font-semibold tabular-nums">{interest === Infinity ? "—" : sek(interest)}</div>
                    </div>
                  </div>

                  {/* Skuldkurva */}
                  {series.length > 2 && (
                    <div className="mt-3 h-20 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <XAxis dataKey="month" hide />
                          <YAxis hide domain={[0, "dataMax"]} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                            formatter={(v: number) => sek(v)}
                            labelFormatter={(m) => `Månad ${m}`}
                          />
                          <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => setPaymentFor(l)} variant="outline" className="flex-1 rounded-xl">
                      <Plus className="h-4 w-4" /> Extra amortering
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        const totalMonthly = l.monthlyPayment + (l.monthlyFee ?? 0);
                        if (totalMonthly <= 0) { toast.error("Lånet saknar månadskostnad"); return; }
                        const alreadyExists = state.recurringTransactions.some(
                          rt => rt.description === l.name && rt.amount === totalMonthly
                        );
                        if (alreadyExists) { toast.info("Återkommande finns redan för detta lån"); return; }
                        dispatch({
                          type: "UPSERT_RECURRING",
                          rt: {
                            id: crypto.randomUUID(),
                            description: l.name,
                            amount: totalMonthly,
                            type: "expense",
                            categoryId: state.categories.find(c => c.isFixed)?.id ?? state.categories[0]?.id ?? "",
                            payerId: l.ownerId ?? state.persons[0]?.id ?? "",
                            dayOfMonth: 25,
                            isActive: true,
                            lastGeneratedMonth: null,
                          },
                        });
                        toast.success(`Återkommande "${l.name}" skapad — ${sek(totalMonthly)}/mån`);
                      }}
                    >
                      <Repeat className="h-4 w-4" /> Lägg i budget
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

        </>
      )}
        </TabsContent>

        <TabsContent value="simulator" className="mt-0 space-y-6">
          <ExtraAmortizationSimulator loans={visibleLoans} />

          {/* Ränteshock — vad händer med totala månadskostnaden om räntan ändras? */}
          {visibleLoans.length > 0 && (
            <Card className="p-6 rounded-2xl border-0 shadow-soft">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h2 className="font-display font-semibold">Ränteshock</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Vad händer med er totala månadskostnad (alla lån) om räntan ändras?</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Slider
                    value={[shockRate ?? 4]}
                    min={0}
                    max={10}
                    step={0.25}
                    onValueChange={(v) => setShockRate(v[0])}
                  />
                  <div className="text-xs text-muted-foreground mt-2">Ny ränta: <span className="font-semibold text-foreground">{(shockRate ?? 4).toFixed(2)}%</span></div>
                </div>
                {shockImpact && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Ny månadskostnad</div>
                    <div className="font-display font-bold text-2xl tabular-nums">{sek(shockImpact.newMonthly)}</div>
                    <div className={cn("text-xs font-medium", shockImpact.diff >= 0 ? "text-destructive" : "text-success")}>
                      {shockImpact.diff >= 0 ? "+" : "−"}{sek(Math.abs(shockImpact.diff))} / mån
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <LoanFormDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditing(null); }}
        loan={editing}
        onSave={(loan) => {
          dispatch({ type: "UPSERT_LOAN", loan });
          toast.success(editing ? "Lån uppdaterat" : "Lån tillagt");
        }}
      />

      <PaymentDialog
        loan={paymentFor}
        onClose={() => setPaymentFor(null)}
        persons={state.persons}
        onSave={(loanId, amount, personId, isExtra, note) => {
          dispatch({
            type: "ADD_LOAN_PAYMENT",
            loanId,
            payment: {
              date: new Date().toISOString().split("T")[0],
              amount,
              personId,
              isExtra,
              note,
            },
          });
          toast.success(`${sek(amount)} amorterat`);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort lån?</AlertDialogTitle>
            <AlertDialogDescription>Lånet och alla amorteringar tas bort permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (deleteId) dispatch({ type: "DELETE_LOAN", id: deleteId }); setDeleteId(null); }}
            >Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "warn" | "muted" }) {
  return (
    <Card className="p-4 md:p-5 rounded-2xl shadow-soft border-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "warn" && "bg-warning-soft text-warning",
          tone === "muted" && "bg-muted text-foreground",
        )}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl md:text-2xl font-display font-bold tabular-nums">{value}</div>
    </Card>
  );
}

function LoanFormDialog({
  open, onOpenChange, loan, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loan: Loan | null;
  onSave: (loan: Loan) => void;
}) {
  const { state } = useBudget();
  const isEdit = !!loan;
  const [name, setName] = useState("");
  const [type, setType] = useState<LoanType>("mortgage");
  const [lender, setLender] = useState("");
  const [originalAmount, setOriginalAmount] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [amortization, setAmortization] = useState(0);
  const [startMonth, setStartMonth] = useState(""); // YYYY-MM
  const [termMonths, setTermMonths] = useState("");  // totalt antal månader

  const [downPayment, setDownPayment] = useState(0);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [rateFixedUntil, setRateFixedUntil] = useState(""); // YYYY-MM

  // Auto-sätt FI:s amorteringskrav när fältet är tomt och LTV är känt
  useEffect(() => {
    if (amortization !== 0) return;
    if (type !== "mortgage" || downPayment <= 0 || originalAmount <= 0) return;
    const ltv = originalAmount / (originalAmount + downPayment);
    const rate = ltv > 0.70 ? 0.02 : ltv > 0.50 ? 0.01 : 0;
    if (rate > 0) setAmortization(Math.ceil(originalAmount * rate / 12));
  }, [type, originalAmount, downPayment]);

  // "private:<personId>" eller "shared"
  const [ownerMode, setOwnerMode] = useState<string>("shared");
  const [ownerShare, setOwnerShare] = useState(57); // andel för person[0]

  // Beräkna slutdatum från startmånad + löptid
  const endMonth = useMemo(() => {
    if (!startMonth || !termMonths) return "";
    const [y, m] = startMonth.split("-").map(Number);
    const n = Number(termMonths);
    if (!n) return "";
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [startMonth, termMonths]);

  // Beräkna kvarvarande månader från idag till slutdatum
  const remainingMonths = useMemo(() => {
    if (!endMonth) return null;
    const [ey, em] = endMonth.split("-").map(Number);
    const now = new Date();
    return Math.max(0, (ey - now.getFullYear()) * 12 + (em - (now.getMonth() + 1)));
  }, [endMonth]);

  useEffect(() => {
    if (!open) return;
    setName(loan?.name ?? "");
    setType(loan?.type ?? "mortgage");
    setLender(loan?.lender ?? "");
    setOriginalAmount(loan ? loan.originalAmount : 0);
    setCurrentBalance(loan ? loan.currentBalance : 0);
    setInterestRate(loan ? loan.interestRate : 0);
    const bal = loan ? loan.currentBalance : 0;
    const rate = loan ? loan.interestRate : 0;
    const calcInterest = Math.round(bal * rate / 100 / 12);
    setAmortization(loan ? Math.max(0, loan.monthlyPayment - calcInterest) : 0);
    setMonthlyFee(loan ? loan.monthlyFee : 0);
    setDownPayment(loan?.downPayment ?? 0);
    setRateFixedUntil(loan?.rateFixedUntil ? loan.rateFixedUntil.slice(0, 7) : "");
    // Startdatum + löptid
    if (loan?.startDate) {
      setStartMonth(loan.startDate.slice(0, 7));
    } else {
      setStartMonth("");
    }
    if (loan?.startDate && loan?.endDate) {
      const [sy, sm] = loan.startDate.slice(0, 7).split("-").map(Number);
      const [ey, em] = loan.endDate.slice(0, 7).split("-").map(Number);
      setTermMonths(String((ey - sy) * 12 + (em - sm)));
    } else {
      setTermMonths("");
    }
    // Ägare
    if (loan?.ownerId) {
      setOwnerMode(`private:${loan.ownerId}`);
      setOwnerShare(loan.ownerShare ?? 100);
    } else {
      setOwnerMode(state.persons.length > 1 ? "shared" : `private:${state.persons[0]?.id ?? ""}`);
      const total = state.persons.reduce((s, p) => s + p.income, 0);
      const p0Share = total > 0 ? Math.round((state.persons[0]?.income ?? 0) / total * 100) : 50;
      setOwnerShare(loan?.ownerShare ?? p0Share);
    }
  }, [open, loan]);

  const submit = () => {
    if (!name.trim()) { toast.error("Ange ett namn"); return; }
    const orig = originalAmount;
    const bal = currentBalance;
    if (bal <= 0) { toast.error("Ange kvarvarande skuld"); return; }
    const rate = interestRate;
    const calcInterest = Math.round(bal * rate / 100 / 12);
    const monthly = amortization + calcInterest;

    const isShared = ownerMode === "shared";
    const resolvedOwnerId = isShared ? null : ownerMode.replace("private:", "");

    onSave({
      id: loan?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      lender: lender.trim(),
      originalAmount: orig || bal,
      currentBalance: bal,
      interestRate: rate,
      monthlyPayment: monthly,
      monthlyAmortization: Math.max(0, monthly - bal * (rate / 100 / 12)),
      monthlyFee,
      downPayment: downPayment > 0 ? downPayment : undefined,
      ownerId: resolvedOwnerId,
      ownerShare: isShared ? ownerShare : 100,
      icon: loan?.icon ?? LOAN_TYPE_ICON[type],
      payments: loan?.payments ?? [],
      startDate: startMonth ? `${startMonth}-01` : loan?.startDate,
      endDate: endMonth ? `${endMonth}-01` : loan?.endDate,
      rateFixedUntil: rateFixedUntil ? `${rateFixedUntil}-01` : undefined,
    });
    onOpenChange(false);
  };

  const p0 = state.persons[0];
  const p1 = state.persons[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Redigera lån" : "Nytt lån"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Namn</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Bolån villa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Typ</Label>
              <Select value={type} onValueChange={(v) => setType(v as LoanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOAN_TYPE_LABEL) as LoanType[]).map(t => (
                    <SelectItem key={t} value={t}>{LOAN_TYPE_ICON[t]} {LOAN_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Långivare</Label>
              <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="t.ex. SEB" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ursprungligt belopp</Label>
              <NumericInput value={originalAmount} onChange={setOriginalAmount} placeholder="kr" />
            </div>
            <div>
              <Label>Kvar att betala</Label>
              <NumericInput value={currentBalance} onChange={setCurrentBalance} placeholder="kr" />
            </div>
          </div>
          <div>
            <Label>Insats / kontantinsats</Label>
            <NumericInput value={downPayment} onChange={setDownPayment} placeholder="kr (valfritt)" />
          </div>
          {downPayment > 0 && originalAmount > 0 && (
            <p className="text-xs text-muted-foreground -mt-1">
              Köpepris: <span className="font-medium text-foreground">{sek(originalAmount + downPayment)}</span>
              {' '}· Belåningsgrad: <span className="font-medium text-foreground">{Math.round(originalAmount / (originalAmount + downPayment) * 100)}%</span>
            </p>
          )}
          <div>
            <Label>Ränta (%)</Label>
            <NumericInput value={interestRate} onChange={setInterestRate} placeholder="t.ex. 4,25" />
          </div>
          {(() => {
            const calcInterest = currentBalance > 0 && interestRate > 0
              ? Math.round(currentBalance * interestRate / 100 / 12)
              : null;
            const total = (calcInterest ?? 0) + amortization + monthlyFee;

            // FI:s amorteringskrav (bara för bolån med känd insats)
            const fiMinAmort = (() => {
              if (type !== "mortgage" || !downPayment || originalAmount <= 0) return null;
              const ltv = originalAmount / (originalAmount + downPayment);
              const pct = ltv > 0.70 ? 0.02 : ltv > 0.50 ? 0.01 : 0;
              return pct > 0 ? Math.ceil(originalAmount * pct / 12) : null;
            })();

            return (
              <div className="space-y-1.5">
                <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border text-sm overflow-hidden">
                  {/* Räntekostnad — beräknad */}
                  <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                    <span className="text-muted-foreground text-xs">Räntekostnad / mån</span>
                    <span className="font-semibold tabular-nums text-xs">
                      {calcInterest != null ? sek(calcInterest) : <span className="text-muted-foreground italic">ange saldo & ränta</span>}
                    </span>
                  </div>
                  {/* Amortering — redigerbar */}
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="text-muted-foreground text-xs shrink-0">Amortering / mån</span>
                    <NumericInput
                      value={amortization}
                      onChange={(v) => setAmortization(v)}
                      placeholder="kr/mån"
                      className="w-32 h-7 text-xs text-right ml-auto"
                    />
                  </div>
                  {/* Månadsavgift — redigerbar */}
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="text-muted-foreground text-xs shrink-0">Månadsavgift förening</span>
                    <NumericInput value={monthlyFee} onChange={setMonthlyFee} placeholder="kr/mån" className="w-32 h-7 text-xs text-right ml-auto" />
                  </div>
                  {/* Totalt */}
                  <div className="flex items-baseline justify-between px-3 py-2.5 bg-muted/50">
                    <span className="text-xs text-muted-foreground">Totalt per månad</span>
                    <span className="font-bold tabular-nums">{total > 0 ? sek(total) : "—"}</span>
                  </div>
                </div>
                {fiMinAmort != null && (
                  <p className="text-[11px] text-muted-foreground px-1">
                    FI:s amorteringskrav: minst <span className="font-medium text-foreground">{sek(fiMinAmort)}/mån</span>
                    {' '}({originalAmount / (originalAmount + downPayment) > 0.70 ? "2" : "1"} % / år · LTV {Math.round(originalAmount / (originalAmount + downPayment) * 100)}%)
                  </p>
                )}
              </div>
            );
          })()}

          {/* Räntebindning — bara för bolån */}
          {type === "mortgage" && (
            <div className="space-y-1">
              <Label>Ränta bunden t.o.m. (valfritt)</Label>
              <MonthPicker value={rateFixedUntil} onChange={setRateFixedUntil} />
              {rateFixedUntil && (
                <p className="text-xs text-muted-foreground">
                  {interestRate > 0 && <>Nuvarande ränta {interestRate}% låst t.o.m.{" "}</>}
                  <span className="font-medium text-foreground">
                    {new Date(`${rateFixedUntil}-01`).toLocaleDateString("sv-SE", { year: "numeric", month: "long" })}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Löptid — döljs för bolån */}
          {type !== "mortgage" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Startmånad</Label>
                  <MonthPicker value={startMonth} onChange={setStartMonth} />
                </div>
                <div>
                  <Label>Löptid (månader)</Label>
                  <Input
                    type="number"
                    value={termMonths}
                    onChange={e => setTermMonths(e.target.value)}
                    onFocus={e => e.target.select()}
                    placeholder="t.ex. 60"
                  />
                </div>
              </div>
              {endMonth && (
                <p className="text-xs text-muted-foreground -mt-1">
                  Slutdatum: <span className="font-medium text-foreground">
                    {new Date(`${endMonth}-01`).toLocaleDateString("sv-SE", { year: "numeric", month: "long" })}
                  </span>
                  {remainingMonths != null && (
                    <> · <span className="font-medium text-foreground">{remainingMonths} månader kvar</span></>
                  )}
                </p>
              )}
            </>
          )}

          {/* Ägarskap */}
          {state.persons.length > 0 && (
            <div className="space-y-2">
              <Label>Ägarskap</Label>
              <div className={cn("grid gap-1 p-1 bg-muted rounded-xl", state.persons.length > 1 ? "grid-cols-3" : "grid-cols-1")}>
                {state.persons.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOwnerMode(`private:${p.id}`)}
                    aria-pressed={ownerMode === `private:${p.id}`}
                    className={cn("py-2 px-2 rounded-lg text-sm font-medium transition truncate", ownerMode === `private:${p.id}` ? "bg-card shadow-soft" : "text-muted-foreground")}
                  >
                    👤 {p.name}
                  </button>
                ))}
                {state.persons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setOwnerMode("shared")}
                    aria-pressed={ownerMode === "shared"}
                    className={cn("py-2 px-2 rounded-lg text-sm font-medium transition", ownerMode === "shared" ? "bg-card shadow-soft" : "text-muted-foreground")}
                  >
                    🤝 Gemensamt
                  </button>
                )}
              </div>

              {/* Fördelningsslider för gemensamma lån */}
              {ownerMode === "shared" && p0 && p1 && (
                <div className="pt-1 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p0.name}: <span className="font-semibold text-foreground">{ownerShare}%</span></span>
                    <span>{p1.name}: <span className="font-semibold text-foreground">{100 - ownerShare}%</span></span>
                  </div>
                  <Slider
                    value={[ownerShare]}
                    min={1}
                    max={99}
                    step={1}
                    onValueChange={v => setOwnerShare(v[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Av {currentBalance ? `${sek(currentBalance)} skuld` : "skulden"} ansvarar {p0.name} för {sek(currentBalance * ownerShare / 100)} och {p1.name} för {sek(currentBalance * (100 - ownerShare) / 100)}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary">{isEdit ? "Spara" : "Lägg till"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  loan, onClose, persons, onSave,
}: {
  loan: Loan | null;
  onClose: () => void;
  persons: { id: string; name: string }[];
  onSave: (loanId: string, amount: number, personId: string, isExtra: boolean, note: string) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [personId, setPersonId] = useState(persons[0]?.id ?? "");
  const [note, setNote] = useState("");

  useMemo(() => {
    if (loan) { setAmount(0); setPersonId(persons[0]?.id ?? ""); setNote(""); }
  }, [loan, persons]);

  const submit = () => {
    if (!loan) return;
    const a = amount;
    if (!a || a <= 0) { toast.error("Ange ett belopp"); return; }
    if (a > loan.currentBalance) {
      toast.error(`Beloppet överstiger kvarvarande skuld (${sek(loan.currentBalance)})`);
      return;
    }
    onSave(loan.id, a, personId, true, note);
    onClose();
  };

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Extra amortering</DialogTitle>
        </DialogHeader>
        {loan && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{loan.name} · kvar {sek(loan.currentBalance)}</div>
            <div>
              <Label>Belopp</Label>
              <NumericInput value={amount} onChange={setAmount} placeholder="kr" autoFocus />
            </div>
            {persons.length > 1 && (
              <div>
                <Label>Vem amorterade?</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notering</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valfritt" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={submit} className="bg-gradient-primary">Amortera</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

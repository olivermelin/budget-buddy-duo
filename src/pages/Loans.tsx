import { useMemo, useState, useEffect } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { Loan, LoanType } from "@/types/budget";
import { sek, pct } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, TrendingDown, AlertTriangle, Banknote, Calendar, Sparkles } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/MonthPicker";

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

// Months until paid off given balance, monthly payment and annual rate %
function monthsToPayoff(balance: number, monthlyPayment: number, annualRate: number): number | null {
  if (balance <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (monthlyPayment <= balance * r) return null; // never pays off
  if (r === 0) return Math.ceil(balance / monthlyPayment);
  // n = -log(1 - r*B/P) / log(1+r)
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
    const monthly = visibleLoans.reduce((s, l) => s + l.monthlyPayment, 0);
    const yearlyInterest = visibleLoans.reduce((s, l) => s + l.currentBalance * (l.interestRate / 100), 0);
    return { debt, original, monthly, yearlyInterest, paidOff: Math.max(0, original - debt) };
  }, [visibleLoans]);

  const debtFreeMonths = useMemo(() => {
    let max = 0;
    let possible = true;
    for (const l of visibleLoans) {
      const m = monthsToPayoff(l.currentBalance, l.monthlyPayment, l.interestRate);
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

  return (
    <div className="space-y-6">
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
              const months = monthsToPayoff(l.currentBalance, l.monthlyPayment, l.interestRate);
              const interest = totalInterest(l.currentBalance, l.monthlyPayment, l.interestRate);
              const series = buildAmortizationSeries(l.currentBalance, l.monthlyPayment, l.interestRate);

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
                <Card key={l.id} className="p-6 rounded-2xl border-0 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">{l.icon || LOAN_TYPE_ICON[l.type]}</div>
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-lg truncate">{l.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {LOAN_TYPE_LABEL[l.type]}{l.lender ? ` · ${l.lender}` : ""} · {l.interestRate}% ränta
                        </div>
                        {/* Ägarbadge */}
                        {(() => {
                          const owner = l.ownerId ? state.persons.find(p => p.id === l.ownerId) : null;
                          if (owner) return (
                            <span className="inline-flex items-center mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                              👤 {owner.name}
                            </span>
                          );
                          if (l.ownerId === null && state.persons.length > 1) return (
                            <span className="inline-flex items-center mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                              🤝 Gemensamt · {l.ownerShare}% / {100 - l.ownerShare}%
                            </span>
                          );
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditing(l); setCreateOpen(true); }}>
                        ✎
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {/* Saldoprogress */}
                    <div>
                      <div className="flex items-baseline justify-between text-sm mb-2">
                        <span className="font-display font-bold text-2xl tabular-nums">{sek(l.currentBalance)}</span>
                        <span className="text-xs text-muted-foreground">av {sek(l.originalAmount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{pct(ratio)} avbetalat</div>
                    </div>

                    {/* Tidsprogress */}
                    {termTotal != null && termPaid != null && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Månad <span className="font-semibold text-foreground">{termPaid}</span> av <span className="font-semibold text-foreground">{termTotal}</span></span>
                          <span>{termTotal - termPaid} månader kvar</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary/40 rounded-full"
                            style={{ width: `${Math.min(100, (termPaid / termTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Per månad" value={sek(l.monthlyPayment)} />
                    <Stat label="Skuldfri" value={months == null ? "Aldrig" : dateInMonths(months)} warn={months == null} />
                    <Stat label="Total ränta" value={interest === Infinity ? "—" : sek(interest)} />
                  </div>

                  {series.length > 2 && (
                    <div className="mt-4 h-24 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <XAxis dataKey="month" hide />
                          <YAxis hide domain={[0, "dataMax"]} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
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
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Rate shock simulator */}
          <Card className="p-6 rounded-2xl border-0 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="font-display font-semibold">Ränteshock-simulator</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Vad händer med er månadskostnad om räntan ändras?</p>
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
        </>
      )}

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

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums mt-0.5 truncate", warn && "text-destructive")}>{value}</div>
    </div>
  );
}

// Beräkna månadsbetalning (annuitet) givet saldo, årsränta och antal månader kvar
function calcMonthlyPayment(balance: number, annualRate: number, months: number): number {
  if (months <= 0 || balance <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return balance / months;
  return balance * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
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
  const [originalAmount, setOriginalAmount] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [startMonth, setStartMonth] = useState(""); // YYYY-MM
  const [termMonths, setTermMonths] = useState("");  // totalt antal månader

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
    setOriginalAmount(loan ? String(loan.originalAmount) : "");
    setCurrentBalance(loan ? String(loan.currentBalance) : "");
    setInterestRate(loan ? String(loan.interestRate) : "");
    setMonthlyPayment(loan ? String(loan.monthlyPayment) : "");
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
    const orig = Number(originalAmount) || 0;
    const bal = Number(currentBalance) || 0;
    if (bal <= 0) { toast.error("Ange kvarvarande skuld"); return; }
    const rate = Number(interestRate) || 0;
    const monthly = Number(monthlyPayment) || 0;

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
      ownerId: resolvedOwnerId,
      ownerShare: isShared ? ownerShare : 100,
      icon: loan?.icon ?? LOAN_TYPE_ICON[type],
      payments: loan?.payments ?? [],
      startDate: startMonth ? `${startMonth}-01` : loan?.startDate,
      endDate: endMonth ? `${endMonth}-01` : loan?.endDate,
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
              <Input inputMode="decimal" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} onFocus={e => e.target.select()} placeholder="kr" />
            </div>
            <div>
              <Label>Kvar att betala</Label>
              <Input inputMode="decimal" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} onFocus={e => e.target.select()} placeholder="kr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ränta (%)</Label>
              <Input inputMode="decimal" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} onFocus={e => e.target.select()} placeholder="t.ex. 4.25" />
            </div>
            <div>
              <Label>Månadskostnad</Label>
              <div className="flex gap-1">
                <Input inputMode="decimal" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} onFocus={e => e.target.select()} placeholder="kr/mån" />
                {remainingMonths != null && Number(currentBalance) > 0 && Number(interestRate) >= 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs px-2"
                    title="Beräkna månadsbetalning från saldo, ränta och kvarvarande löptid"
                    onClick={() => setMonthlyPayment(String(Math.ceil(calcMonthlyPayment(Number(currentBalance), Number(interestRate), remainingMonths))))}
                  >
                    Beräkna
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Löptid */}
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
                    Av {currentBalance ? `${sek(Number(currentBalance))} skuld` : "skulden"} ansvarar {p0.name} för {sek(Number(currentBalance || 0) * ownerShare / 100)} och {p1.name} för {sek(Number(currentBalance || 0) * (100 - ownerShare) / 100)}.
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
  const [amount, setAmount] = useState("");
  const [personId, setPersonId] = useState(persons[0]?.id ?? "");
  const [note, setNote] = useState("");

  useMemo(() => {
    if (loan) { setAmount(""); setPersonId(persons[0]?.id ?? ""); setNote(""); }
  }, [loan, persons]);

  const submit = () => {
    if (!loan) return;
    const a = Number(amount);
    if (!a || a <= 0) { toast.error("Ange ett belopp"); return; }
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
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onFocus={e => e.target.select()} placeholder="kr" autoFocus />
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

import { useEffect, useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { sek, pct } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Home,
  TrendingDown,
  Save,
  Trash2,
  Calculator,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Typer ────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  price: number;
  downPayment: number;
  rate: number;
  brfFee: number;
  driftCost: number;
  termYears: number;
  splitMode: "50/50" | "income";
  createdAt: string;
}

const STORAGE_KEY = "budgetbuddy.mortgage-scenarios.v1";

// ── Svenska beräkningsregler ─────────────────────────────────────────────────

/**
 * Amorteringskrav enligt Finansinspektionen:
 *  >70% belåningsgrad → 2% av lånebeloppet/år
 *  50–70%             → 1%
 *  Skuldkvotstillägg: lån > 4,5 × bruttoinkomst → +1%
 */
function amortizationRate(loanAmount: number, propertyValue: number, grossYearlyIncome: number): number {
  const ltv = propertyValue > 0 ? loanAmount / propertyValue : 0;
  let rate = 0;
  if (ltv > 0.7) rate = 0.02;
  else if (ltv > 0.5) rate = 0.01;

  // Skuldkvotstillägg
  if (grossYearlyIncome > 0 && loanAmount > grossYearlyIncome * 4.5) {
    rate += 0.01;
  }
  return rate;
}

/**
 * Ränteavdrag: 30% upp till 100 000 kr räntekostnad/år, sedan 21%.
 */
function taxDeduction(yearlyInterest: number): number {
  const cap = 100_000;
  if (yearlyInterest <= cap) return yearlyInterest * 0.3;
  return cap * 0.3 + (yearlyInterest - cap) * 0.21;
}

interface Calc {
  loanAmount: number;
  ltv: number;
  amortRatePct: number;
  monthlyAmortization: number;
  monthlyInterestGross: number;
  monthlyInterestNet: number; // efter ränteavdrag
  yearlyInterest: number;
  yearlyDeduction: number;
  monthlyDeduction: number;
  monthlyTotalGross: number; // ränta + amort + brf + drift (före avdrag)
  monthlyTotalNet: number;   // efter ränteavdrag
}

function computeMortgage(
  price: number,
  downPayment: number,
  rate: number,
  brfFee: number,
  driftCost: number,
  grossYearlyIncome: number,
): Calc {
  const loanAmount = Math.max(0, price - downPayment);
  const ltv = price > 0 ? loanAmount / price : 0;
  const amortRatePct = amortizationRate(loanAmount, price, grossYearlyIncome);
  const monthlyAmortization = (loanAmount * amortRatePct) / 12;
  const monthlyInterestGross = (loanAmount * (rate / 100)) / 12;
  const yearlyInterest = monthlyInterestGross * 12;
  const yearlyDeduction = taxDeduction(yearlyInterest);
  const monthlyDeduction = yearlyDeduction / 12;
  const monthlyInterestNet = monthlyInterestGross - monthlyDeduction;
  const monthlyTotalGross = monthlyAmortization + monthlyInterestGross + brfFee + driftCost;
  const monthlyTotalNet = monthlyAmortization + monthlyInterestNet + brfFee + driftCost;
  return {
    loanAmount,
    ltv,
    amortRatePct,
    monthlyAmortization,
    monthlyInterestGross,
    monthlyInterestNet,
    yearlyInterest,
    yearlyDeduction,
    monthlyDeduction,
    monthlyTotalGross,
    monthlyTotalNet,
  };
}

/**
 * Amorteringsplan över 10 år (var 6:e månad-punkter).
 * Räntan antas konstant.
 */
function buildPayoffSeries(
  loanAmount: number,
  rate: number,
  amortRatePct: number,
  months = 120,
) {
  const r = rate / 100 / 12;
  const monthlyAmort = (loanAmount * amortRatePct) / 12;
  const series: { month: number; balance: number }[] = [
    { month: 0, balance: Math.round(loanAmount) },
  ];
  let b = loanAmount;
  for (let m = 1; m <= months && b > 0; m++) {
    // Vi följer rak amortering (svensk modell), inte annuitet
    b = Math.max(0, b - monthlyAmort);
    if (m % 6 === 0 || b <= 0 || m === months) {
      series.push({ month: m, balance: Math.round(b) });
    }
  }
  return series;
}

// ── Komponent ────────────────────────────────────────────────────────────────

export function MortgageCalculator() {
  const { state, dispatch } = useBudget();

  // Hämta inkomster för stresstest & amorteringskrav
  const grossYearlyIncome = useMemo(
    () => state.persons.reduce((s, p) => s + p.income, 0) * 12,
    [state.persons],
  );

  // ── Inputs ────────────────────────────────────────────────────────────────
  const [price, setPrice] = useState(4_500_000);
  const [downPayment, setDownPayment] = useState(675_000); // 15%
  const [rate, setRate] = useState(4.5);
  const [brfFee, setBrfFee] = useState(4_200);
  const [driftCost, setDriftCost] = useState(1_500);
  const [termYears, setTermYears] = useState(30);
  const [splitMode, setSplitMode] = useState<"50/50" | "income">(state.settings.splitMode);

  // Stress test
  const [stressRate, setStressRate] = useState(7);

  // Scenarier
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setScenarios(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persistScenarios = (next: Scenario[]) => {
    setScenarios(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // ── Beräkningar ───────────────────────────────────────────────────────────
  const calc = useMemo(
    () => computeMortgage(price, downPayment, rate, brfFee, driftCost, grossYearlyIncome),
    [price, downPayment, rate, brfFee, driftCost, grossYearlyIncome],
  );

  const stressCalc = useMemo(
    () => computeMortgage(price, downPayment, stressRate, brfFee, driftCost, grossYearlyIncome),
    [price, downPayment, stressRate, brfFee, driftCost, grossYearlyIncome],
  );

  const series = useMemo(
    () => buildPayoffSeries(calc.loanAmount, rate, calc.amortRatePct, termYears * 12),
    [calc.loanAmount, rate, calc.amortRatePct, termYears],
  );

  // ── Validering & varningar ────────────────────────────────────────────────
  const ltvPct = calc.ltv * 100;
  const minDownPayment = price * 0.15;
  const downPaymentTooLow = downPayment < minDownPayment - 0.5;

  const debtRatio = grossYearlyIncome > 0 ? calc.loanAmount / grossYearlyIncome : 0;
  const maxLoanByBank = grossYearlyIncome * 5; // bankerna lånar normalt max ~5x årsinkomst
  const overBankLimit = grossYearlyIncome > 0 && calc.loanAmount > maxLoanByBank;

  // ── Fördelning per person ─────────────────────────────────────────────────
  const persons = state.persons.filter(p => !p.id.startsWith("placeholder"));
  const totalIncome = persons.reduce((s, p) => s + p.income, 0);
  const personShares = persons.map(p => {
    const share =
      splitMode === "50/50"
        ? 1 / Math.max(1, persons.length)
        : totalIncome > 0
          ? p.income / totalIncome
          : 1 / Math.max(1, persons.length);
    return {
      person: p,
      share,
      monthlyNet: calc.monthlyTotalNet * share,
      monthlyGross: calc.monthlyTotalGross * share,
      stressMonthly: stressCalc.monthlyTotalNet * share,
    };
  });

  // ── Jämför mot nuvarande fasta utgifter (Boende-kategori) ─────────────────
  const boendeCategoryId = state.categories.find(
    c => c.name.toLowerCase() === "boende" || c.id === "boende",
  )?.id;

  const currentHousingMonthly = useMemo(() => {
    if (!boendeCategoryId) return 0;
    return state.recurringTransactions
      .filter(r => r.isActive && r.type === "expense" && r.categoryId === boendeCategoryId)
      .reduce((s, r) => s + r.amount, 0);
  }, [state.recurringTransactions, boendeCategoryId]);

  const monthlyDelta = calc.monthlyTotalNet - currentHousingMonthly;

  // ── Köpkostnader (engångs) ────────────────────────────────────────────────
  const lagfart = price * 0.015 + 825; // gäller villa, ej brf — visa ändå info
  const pantbrev = calc.loanAmount * 0.02 + 375;
  // OBS: Bostadsrätt = ingen lagfart, bara medlemskap. Vi flaggar detta.

  // ── Actions ───────────────────────────────────────────────────────────────
  const loadScenario = (s: Scenario) => {
    setPrice(s.price);
    setDownPayment(s.downPayment);
    setRate(s.rate);
    setBrfFee(s.brfFee);
    setDriftCost(s.driftCost);
    setTermYears(s.termYears);
    setSplitMode(s.splitMode);
    toast.success(`Laddade "${s.name}"`);
  };

  const saveScenario = () => {
    const name = saveName.trim() || `Bostad ${scenarios.length + 1}`;
    const next: Scenario = {
      id: crypto.randomUUID(),
      name,
      price,
      downPayment,
      rate,
      brfFee,
      driftCost,
      termYears,
      splitMode,
      createdAt: new Date().toISOString(),
    };
    persistScenarios([next, ...scenarios]);
    setSaveOpen(false);
    setSaveName("");
    toast.success("Scenario sparat");
  };

  const deleteScenario = (id: string) => {
    persistScenarios(scenarios.filter(s => s.id !== id));
  };

  const convertToRealLoan = () => {
    // Lägg till bolånet
    const ownerShare = splitMode === "income" && totalIncome > 0 && persons[0]
      ? Math.round((persons[0].income / totalIncome) * 100)
      : 50;

    dispatch({
      type: "UPSERT_LOAN",
      loan: {
        id: crypto.randomUUID(),
        name: saveName.trim() || "Bolån (planerat)",
        type: "mortgage",
        lender: "",
        originalAmount: calc.loanAmount,
        currentBalance: calc.loanAmount,
        interestRate: rate,
        monthlyPayment: calc.monthlyAmortization + calc.monthlyInterestGross,
        monthlyAmortization: calc.monthlyAmortization,
        ownerId: persons.length > 1 ? null : persons[0]?.id ?? null,
        ownerShare: persons.length > 1 ? ownerShare : 100,
        icon: "🏠",
        payments: [],
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + termYears))
          .toISOString()
          .split("T")[0],
      },
    });

    // Lägg till BRF-avgiften som återkommande utgift
    if (boendeCategoryId && brfFee > 0 && persons[0]) {
      dispatch({
        type: "UPSERT_RECURRING",
        rt: {
          id: crypto.randomUUID(),
          description: "BRF-avgift",
          amount: brfFee,
          type: "expense",
          categoryId: boendeCategoryId,
          payerId: persons[0].id,
          dayOfMonth: 28,
          isActive: true,
          lastGeneratedMonth: null,
        },
      });
    }

    setConvertOpen(false);
    toast.success("Bolån & BRF-avgift skapade", {
      description: "Du hittar dem under Mina lån och Inställningar → Återkommande.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
          <Home className="h-6 w-6 text-primary" /> Bostadskalkyl
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Räkna ut månadskostnaden för en planerad bostad — och hur den fördelas mellan er.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Inputs */}
        <Card className="p-6 rounded-2xl border-0 shadow-soft lg:col-span-1 space-y-4 h-fit">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Bostaden
          </h3>

          <NumberField
            label="Bostadspris"
            value={price}
            onChange={setPrice}
            suffix="kr"
            help={`Ungefärligt utgångspris.`}
          />

          <div>
            <NumberField
              label="Kontantinsats"
              value={downPayment}
              onChange={setDownPayment}
              suffix="kr"
              help={`Belåningsgrad: ${ltvPct.toFixed(0)}% (min 15%)`}
            />
            {downPaymentTooLow && (
              <div className="mt-2 flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Lagkrav är minst 15% kontantinsats ({sek(minDownPayment)}).</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <Label>Ränta</Label>
              <span className="font-display font-bold tabular-nums">{rate.toFixed(2)}%</span>
            </div>
            <Slider value={[rate]} min={1} max={8} step={0.05} onValueChange={v => setRate(v[0])} />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <Label>Löptid</Label>
              <span className="font-display font-bold tabular-nums">{termYears} år</span>
            </div>
            <Slider
              value={[termYears]}
              min={5}
              max={50}
              step={1}
              onValueChange={v => setTermYears(v[0])}
            />
          </div>

          <NumberField
            label="Månadsavgift (BRF)"
            value={brfFee}
            onChange={setBrfFee}
            suffix="kr/mån"
          />
          <NumberField
            label="Driftkostnader"
            value={driftCost}
            onChange={setDriftCost}
            suffix="kr/mån"
            help="El, hemförsäkring, bredband"
          />

          {persons.length > 1 && (
            <div>
              <Label className="text-sm">Fördelningsmodell</Label>
              <div className="mt-2 grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
                {(["50/50", "income"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSplitMode(m)}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-sm font-medium transition",
                      splitMode === m ? "bg-card shadow-soft" : "text-muted-foreground",
                    )}
                  >
                    {m === "50/50" ? "Lika delat" : "Efter inkomst"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSaveOpen(true)}>
              <Save className="h-4 w-4" /> Spara scenario
            </Button>
            <Button className="flex-1 rounded-xl bg-gradient-primary" onClick={() => setConvertOpen(true)}>
              <ArrowRight className="h-4 w-4" /> Gör till lån
            </Button>
          </div>
        </Card>

        {/* Resultat */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hero */}
          <Card className="relative overflow-hidden border-0 bg-gradient-hero text-white p-6 md:p-8 rounded-3xl shadow-elegant">
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative">
              <p className="text-sm uppercase tracking-wider opacity-80">Månadskostnad efter ränteavdrag</p>
              <div className="mt-2 text-5xl md:text-6xl font-display font-extrabold tabular-nums">
                {sek(calc.monthlyTotalNet)}
              </div>
              <p className="mt-2 text-sm opacity-80">
                Före avdrag: <span className="font-semibold">{sek(calc.monthlyTotalGross)}</span> · Lån: {sek(calc.loanAmount)}
              </p>

              {currentHousingMonthly > 0 && (
                <div className="mt-5 inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {monthlyDelta >= 0
                    ? `${sek(monthlyDelta)}/mån mer än er nuvarande hyra`
                    : `${sek(Math.abs(monthlyDelta))}/mån mindre än idag`}
                </div>
              )}
            </div>
          </Card>

          {/* Breakdown */}
          <Card className="p-6 rounded-2xl border-0 shadow-soft">
            <h3 className="font-display font-semibold mb-4">Så fördelas månadskostnaden</h3>
            <div className="space-y-2">
              <Row label={`Ränta (${rate.toFixed(2)}%)`} value={sek(calc.monthlyInterestGross)} />
              <Row
                label={`Amortering (${(calc.amortRatePct * 100).toFixed(0)}% av lån/år)`}
                value={sek(calc.monthlyAmortization)}
              />
              <Row label="BRF-avgift" value={sek(brfFee)} />
              <Row label="Drift (el, försäkring m.m.)" value={sek(driftCost)} />
              <div className="border-t pt-2 mt-2">
                <Row label="Summa före avdrag" value={sek(calc.monthlyTotalGross)} bold />
              </div>
              <Row
                label="− Ränteavdrag (30%/21%)"
                value={`− ${sek(calc.monthlyDeduction)}`}
                tone="success"
              />
              <div className="border-t pt-2 mt-2">
                <Row label="Faktisk månadskostnad" value={sek(calc.monthlyTotalNet)} bold large />
              </div>
            </div>

            {(overBankLimit || calc.amortRatePct >= 0.03) && (
              <div className="mt-4 flex items-start gap-2 text-xs text-warning bg-warning-soft p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {overBankLimit && (
                    <div>
                      Lånet är {(debtRatio).toFixed(1)}× er årsinkomst — banker beviljar normalt max ~5×.
                    </div>
                  )}
                  {calc.amortRatePct >= 0.03 && (
                    <div>Skuldkvotstillägg gäller: +1% extra amortering pga hög skuldkvot.</div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Per person */}
          {personShares.length > 0 && (
            <Card className="p-6 rounded-2xl border-0 shadow-soft">
              <h3 className="font-display font-semibold mb-4">Per person</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {personShares.map(({ person, share, monthlyNet }) => (
                  <div key={person.id} className="rounded-xl bg-muted/40 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm">
                        {person.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{person.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Andel: {pct(share)}
                          {splitMode === "income" && person.income > 0 && (
                            <> · {sek(person.income)}/mån inkomst</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-2xl font-display font-bold tabular-nums">
                      {sek(monthlyNet)}
                    </div>
                    <div className="text-xs text-muted-foreground">per månad efter avdrag</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Stresstest */}
          <Card className="p-6 rounded-2xl border-0 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-warning" />
              <h3 className="font-display font-semibold">Stresstest — räntechock</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Klarar ni en högre ränta? Skjut reglaget för att se månadskostnaden vid annan ränta.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Slider
                  value={[stressRate]}
                  min={1}
                  max={10}
                  step={0.25}
                  onValueChange={v => setStressRate(v[0])}
                />
                <div className="text-xs text-muted-foreground mt-2">
                  Stressränta: <span className="font-semibold text-foreground">{stressRate.toFixed(2)}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Ny månadskostnad</div>
                <div className="font-display font-bold text-2xl tabular-nums">
                  {sek(stressCalc.monthlyTotalNet)}
                </div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    stressCalc.monthlyTotalNet >= calc.monthlyTotalNet
                      ? "text-destructive"
                      : "text-success",
                  )}
                >
                  {stressCalc.monthlyTotalNet >= calc.monthlyTotalNet ? "+" : "−"}
                  {sek(Math.abs(stressCalc.monthlyTotalNet - calc.monthlyTotalNet))} / mån
                </div>
              </div>
            </div>
          </Card>

          {/* Amorteringsgraf */}
          <Card className="p-6 rounded-2xl border-0 shadow-soft">
            <h3 className="font-display font-semibold mb-1">Skuldutveckling över {termYears} år</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Antar rak amortering enligt amorteringskravet och oförändrad ränta.
            </p>
            <div className="h-56 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={m => `År ${Math.round(m / 12)}`}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => sek(v)}
                    labelFormatter={m => `Månad ${m}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Engångskostnader */}
          <Card className="p-6 rounded-2xl border-0 shadow-soft">
            <h3 className="font-display font-semibold mb-3">Engångskostnader att räkna med</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Pantbrev (2% av lån + 375 kr)</div>
                <div className="font-display font-bold tabular-nums mt-1">{sek(pantbrev)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Endast nya pantbrev — befintliga kan tas över.
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Lagfart (1,5% + 825 kr)</div>
                <div className="font-display font-bold tabular-nums mt-1">{sek(lagfart)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Gäller villa/radhus — bostadsrätt har ingen lagfart.
                </div>
              </div>
            </div>
          </Card>

          {/* Sparade scenarier */}
          {scenarios.length > 0 && (
            <Card className="p-6 rounded-2xl border-0 shadow-soft">
              <h3 className="font-display font-semibold mb-3">Sparade scenarier</h3>
              <div className="space-y-2">
                {scenarios.map(s => {
                  const c = computeMortgage(
                    s.price,
                    s.downPayment,
                    s.rate,
                    s.brfFee,
                    s.driftCost,
                    grossYearlyIncome,
                  );
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sek(s.price)} · {s.rate.toFixed(2)}% · {sek(s.brfFee)}/mån avgift
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold tabular-nums">
                          {sek(c.monthlyTotalNet)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">/mån</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => loadScenario(s)}
                      >
                        Ladda
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteScenario(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Spara-dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Spara scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Namn</Label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="t.ex. 3:a på Söder"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sparas lokalt i din webbläsare så ni kan jämföra flera bostäder.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={saveScenario} className="bg-gradient-primary">
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konvertera-dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Skapa verkligt bolån</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Detta lägger till ett bolån på <span className="font-semibold text-foreground">{sek(calc.loanAmount)}</span> samt
              en återkommande BRF-avgift på <span className="font-semibold text-foreground">{sek(brfFee)}</span>/mån.
            </p>
            <div>
              <Label>Namn på lånet</Label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="t.ex. Bolån Söder"
              />
            </div>
            {currentHousingMonthly > 0 && (
              <div className="text-xs bg-warning-soft text-warning p-2 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Glöm inte att inaktivera era nuvarande boendekostnader (hyra, parkering) under
                  Inställningar → Återkommande.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={convertToRealLoan} className="bg-gradient-primary">
              Skapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Hjälpkomponenter ─────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  suffix,
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  help?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm">{label}</Label>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <Input
        inputMode="decimal"
        value={value === 0 ? "" : value}
        onChange={e => {
          const v = e.target.value.replace(/\s/g, "").replace(",", ".");
          onChange(Number(v) || 0);
        }}
        onFocus={e => e.target.select()}
      />
      {help && <p className="text-[11px] text-muted-foreground mt-1">{help}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  large,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={cn("text-muted-foreground", bold && "text-foreground font-medium")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          bold && "font-display font-bold",
          large && "text-xl",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

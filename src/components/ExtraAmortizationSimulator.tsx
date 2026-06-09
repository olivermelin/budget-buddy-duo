import { useMemo, useState } from "react";
import { Loan } from "@/types/budget";
import { sek } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TrendingDown, Clock, Sparkles, PiggyBank, Info } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  loans: Loan[];
}

interface SimPoint {
  year: number;
  baseline: number | null;
  extra: number | null;
  baselineInterest: number | null;
  extraInterest: number | null;
}

// Ränteavdrag: 30 % upp till 100 000 kr/år, 21 % däröver (Skatteverket)
function taxDeductionFactor(annualInterest: number): number {
  if (annualInterest <= 0) return 0;
  const threshold = 100_000;
  if (annualInterest <= threshold) return 0.30;
  return (threshold * 0.30 + (annualInterest - threshold) * 0.21) / annualInterest;
}

function effectiveRate(balanceNow: number, annualRate: number, applyTax: boolean): number {
  if (!applyTax) return annualRate;
  const annualInterest = balanceNow * (annualRate / 100);
  const factor = taxDeductionFactor(annualInterest);
  return annualRate * (1 - factor);
}

function buildSimulation(
  balance: number,
  annualRate: number,
  monthlyAmortization: number,
  extraMonthly: number,
  lumpSum: number,
  applyTax: boolean,
  maxYears = 50,
): {
  baselineMonths: number | null;
  extraMonths: number | null;
  baselineInterest: number;
  extraInterest: number;
  series: SimPoint[];
} {
  if (balance <= 0 || monthlyAmortization <= 0) {
    return { baselineMonths: null, extraMonths: null, baselineInterest: 0, extraInterest: 0, series: [] };
  }

  const maxMonths = maxYears * 12;

  let bBase = balance;
  let bExtra = Math.max(0, balance - lumpSum);
  let intBase = 0;
  let intExtra = 0;
  let baselineMonths: number | null = null;
  let extraMonths: number | null = null;

  // Effektiv månadsränta givet aktuellt saldo (tar hänsyn till ränteavdrag om aktiverat)
  const rEff = (b: number) => b * (effectiveRate(b, annualRate, applyTax) / 100 / 12);

  interface YearEntry {
    base: number;
    extra: number;
    baseMonthlyInterest: number;
    extraMonthlyInterest: number;
  }
  const yearlyData: Map<number, YearEntry> = new Map();
  yearlyData.set(0, {
    base: bBase,
    extra: bExtra,
    baseMonthlyInterest: Math.round(rEff(bBase)),
    extraMonthlyInterest: Math.round(rEff(bExtra)),
  });

  for (let m = 1; m <= maxMonths; m++) {
    if (bBase > 0) {
      intBase += rEff(bBase);
      bBase = Math.max(0, bBase - monthlyAmortization);
      if (bBase === 0 && baselineMonths == null) baselineMonths = m;
    }
    if (bExtra > 0) {
      intExtra += rEff(bExtra);
      bExtra = Math.max(0, bExtra - (monthlyAmortization + extraMonthly));
      if (bExtra === 0 && extraMonths == null) extraMonths = m;
    }
    if (m % 12 === 0) {
      const yr = m / 12;
      yearlyData.set(yr, {
        base: Math.round(bBase),
        extra: Math.round(bExtra),
        baseMonthlyInterest: Math.round(rEff(bBase)),
        extraMonthlyInterest: Math.round(rEff(bExtra)),
      });
    }
    if (bBase === 0 && bExtra === 0) break;
  }

  const maxYear = Math.ceil(Math.max(baselineMonths ?? 0, extraMonths ?? 0) / 12);
  const series: SimPoint[] = [];
  for (let yr = 0; yr <= maxYear; yr++) {
    const d = yearlyData.get(yr);
    series.push({
      year: yr,
      baseline: d ? (d.base > 0 || yr === 0 ? d.base : null) : null,
      extra: d ? (d.extra > 0 || yr === 0 ? d.extra : null) : null,
      baselineInterest: d ? (d.base > 0 || yr === 0 ? d.baseMonthlyInterest : null) : null,
      extraInterest: d ? (d.extra > 0 || yr === 0 ? d.extraMonthlyInterest : null) : null,
    });
  }

  return { baselineMonths, extraMonths, baselineInterest: intBase, extraInterest: intExtra, series };
}

function monthsToLabel(months: number | null): string {
  if (months == null) return "Aldrig";
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "long" });
}

function monthDiff(a: number | null, b: number | null): string {
  if (a == null || b == null) return "—";
  const diff = a - b;
  if (diff <= 0) return "Ingen skillnad";
  const yrs = Math.floor(diff / 12);
  const mo = diff % 12;
  const parts = [];
  if (yrs > 0) parts.push(`${yrs} år`);
  if (mo > 0) parts.push(`${mo} mån`);
  return parts.join(" ");
}

const LOAN_TYPE_ICON: Record<string, string> = {
  mortgage: "🏠",
  car: "🚗",
  student: "🎓",
  personal: "💸",
  credit_card: "💳",
  other: "💰",
};

export function ExtraAmortizationSimulator({ loans }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    loans.find(l => l.type === "mortgage")?.id ?? loans[0]?.id ?? "__manual__",
  );
  const [manualBalance, setManualBalance] = useState(2_700_000);
  const [manualRate, setManualRate] = useState(3.0);
  const [manualAmort, setManualAmort] = useState(2_250);

  const [extraMonthly, setExtraMonthly] = useState(2_000);
  const [lumpSum, setLumpSum] = useState(0);
  const [applyTax, setApplyTax] = useState(true);

  const isManual = selectedId === "__manual__";

  const loan = useMemo(
    () => (isManual ? null : loans.find(l => l.id === selectedId) ?? null),
    [selectedId, loans, isManual],
  );

  const balance = loan?.currentBalance ?? manualBalance;
  const annualRate = loan?.interestRate ?? manualRate;
  const baseAmort = loan
    ? (loan.monthlyAmortization > 0
        ? loan.monthlyAmortization
        : Math.max(0, loan.monthlyPayment - Math.round(loan.currentBalance * loan.interestRate / 100 / 12)))
    : manualAmort;

  const sim = useMemo(
    () => buildSimulation(balance, annualRate, baseAmort, extraMonthly, lumpSum, applyTax),
    [balance, annualRate, baseAmort, extraMonthly, lumpSum, applyTax],
  );

  const interestSaving = sim.baselineInterest - sim.extraInterest;
  const totalExtraPaid = sim.extraMonths != null
    ? extraMonthly * sim.extraMonths + lumpSum
    : lumpSum;

  const roi = totalExtraPaid > 0 ? interestSaving / totalExtraPaid : null;

  const r = annualRate / 100 / 12;
  const currentMonthlyInterestGross = Math.round(balance * r);
  const annualInterestNow = balance * (annualRate / 100);
  const deductionFactor = applyTax ? taxDeductionFactor(annualInterestNow) : 0;
  const monthlyDeduction = Math.round(currentMonthlyInterestGross * deductionFactor);
  const currentMonthlyInterest = currentMonthlyInterestGross - monthlyDeduction;
  const currentMonthlyCost = currentMonthlyInterest + baseAmort;
  const newMonthlyCost = currentMonthlyInterest + baseAmort + extraMonthly;

  // Välj snygga milstolpar för räntetabellen: år 0, 5, 10, 15, 20 (om de finns)
  const interestMilestones = useMemo(() => {
    const steps = [0, 5, 10, 15, 20, 25, 30];
    return steps
      .map(yr => sim.series.find(p => p.year === yr))
      .filter((p): p is SimPoint => p != null && (p.baselineInterest != null || p.extraInterest != null));
  }, [sim.series]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Amorteringssimulator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Se hur mycket ni sparar i ränta och tid genom att amortera extra.
        </p>
      </div>

      {/* Lånväljare + inmatning */}
      <Card className="p-5 rounded-2xl border-0 shadow-soft space-y-4">
        <h2 className="font-display font-semibold text-base">Vilket lån vill du simulera?</h2>

        <div>
          <Label>Lån</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loans.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {LOAN_TYPE_ICON[l.type] ?? "💰"} {l.name} — {sek(l.currentBalance)}
                </SelectItem>
              ))}
              <SelectItem value="__manual__">✏️ Ange manuellt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isManual ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Kvarvarande skuld</Label>
              <NumericInput value={manualBalance} onChange={setManualBalance} placeholder="kr" className="mt-1" />
            </div>
            <div>
              <Label>Ränta (%)</Label>
              <NumericInput value={manualRate} onChange={setManualRate} placeholder="t.ex. 3,5" className="mt-1" />
            </div>
            <div>
              <Label>Nuvarande amortering/mån</Label>
              <NumericInput value={manualAmort} onChange={setManualAmort} placeholder="kr/mån" className="mt-1" />
            </div>
          </div>
        ) : loan ? (
          <div className="rounded-xl bg-muted/40 px-4 py-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Skuld</div>
              <div className="font-semibold tabular-nums">{sek(loan.currentBalance)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Ränta</div>
              <div className="font-semibold tabular-nums">{loan.interestRate}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Räntekostnad/mån</div>
              <div className="font-semibold tabular-nums">{sek(currentMonthlyInterest)}</div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Simulatorkontroller */}
      <Card className="p-5 rounded-2xl border-0 shadow-soft space-y-6">
        <h2 className="font-display font-semibold text-base">Justera extraamortering</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Extra amortering per månad</Label>
            <span className="text-lg font-display font-bold text-primary tabular-nums">{sek(extraMonthly)}</span>
          </div>
          <Slider
            value={[extraMonthly]}
            min={0}
            max={20_000}
            step={500}
            onValueChange={v => setExtraMonthly(v[0])}
            className="py-1"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 kr</span>
            <span>5 000 kr</span>
            <span>10 000 kr</span>
            <span>15 000 kr</span>
            <span>20 000 kr</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Engångsbetalning nu (valfritt)</Label>
          <NumericInput value={lumpSum} onChange={setLumpSum} placeholder="t.ex. 50 000 kr" className="max-w-xs" />
          <p className="text-xs text-muted-foreground">En extra inbetalning direkt som sänker startbalansen.</p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              Räkna med ränteavdrag
              <span className="text-xs font-normal text-muted-foreground">(30 % upp till 100 000 kr/år)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Svenska bolåneräntor är avdragsgilla i deklarationen — din reella kostnad är lägre.
            </p>
          </div>
          <Switch checked={applyTax} onCheckedChange={setApplyTax} />
        </div>
      </Card>

      {/* Månadskostnad — nuläge vs med extra */}
      <Card className="p-5 rounded-2xl border-0 shadow-soft">
        <h2 className="font-display font-semibold text-base mb-4">Månadskostnad — nuläge vs med extra</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Nuläge */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuvarande plan</span>
            </div>
            <div className="divide-y divide-border/40">
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Räntekostnad (brutto)</span>
                <span className="text-sm tabular-nums font-medium">{sek(currentMonthlyInterestGross)}<span className="text-muted-foreground font-normal">/mån</span></span>
              </div>
              {applyTax && monthlyDeduction > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5 bg-success/5">
                  <span className="text-sm text-success flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> Ränteavdrag ({Math.round(deductionFactor * 100)}%)
                  </span>
                  <span className="text-sm tabular-nums font-medium text-success">−{sek(monthlyDeduction)}<span className="font-normal">/mån</span></span>
                </div>
              )}
              {applyTax && monthlyDeduction > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Effektiv räntekostnad</span>
                  <span className="text-sm tabular-nums font-medium">{sek(currentMonthlyInterest)}<span className="text-muted-foreground font-normal">/mån</span></span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Amortering</span>
                <span className="text-sm tabular-nums font-medium">{sek(baseAmort)}<span className="text-muted-foreground font-normal">/mån</span></span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-muted/30">
                <span className="text-sm font-semibold">Totalt / mån</span>
                <span className="font-bold text-lg tabular-nums">{sek(currentMonthlyCost)}</span>
              </div>
            </div>
          </div>

          {/* Med extra */}
          <div className="rounded-xl border border-primary/30 overflow-hidden bg-primary/[0.03]">
            <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">Med extraamortering</span>
            </div>
            <div className="divide-y divide-border/40">
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Räntekostnad (brutto)</span>
                <span className="text-sm tabular-nums font-medium">{sek(currentMonthlyInterestGross)}<span className="text-muted-foreground font-normal">/mån</span></span>
              </div>
              {applyTax && monthlyDeduction > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5 bg-success/5">
                  <span className="text-sm text-success flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> Ränteavdrag ({Math.round(deductionFactor * 100)}%)
                  </span>
                  <span className="text-sm tabular-nums font-medium text-success">−{sek(monthlyDeduction)}<span className="font-normal">/mån</span></span>
                </div>
              )}
              {applyTax && monthlyDeduction > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Effektiv räntekostnad</span>
                  <span className="text-sm tabular-nums font-medium">{sek(currentMonthlyInterest)}<span className="text-muted-foreground font-normal">/mån</span></span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Amortering</span>
                <span className="text-sm tabular-nums font-medium text-primary">
                  {sek(baseAmort + extraMonthly)}<span className="text-muted-foreground font-normal">/mån</span>
                  {extraMonthly > 0 && (
                    <span className="ml-1.5 text-xs text-primary/70">(+{sek(extraMonthly)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
                <span className="text-sm font-semibold">Totalt / mån</span>
                <div className="text-right">
                  <div className="font-bold text-lg tabular-nums text-primary">{sek(newMonthlyCost)}</div>
                  {extraMonthly > 0 && (
                    <div className="text-xs text-muted-foreground">+{sek(extraMonthly)} vs nuläge</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {applyTax
            ? <>Kostnaderna ovan inkluderar ränteavdrag. Ränteavdraget betalas ut i samband med deklarationen — er löpande månadskostnad är högre, men <span className="font-medium text-foreground">ni får tillbaka {sek(monthlyDeduction)} kr/mån i snitt via skatten</span>.</>
            : <>Räntekostnaden gäller för <span className="font-medium text-foreground">idag</span>. Aktivera ränteavdrag ovan för att se reell kostnad efter skatt.</>
          }
        </p>
      </Card>

      {/* Nyckelinsikt */}
      {sim.baselineMonths != null && extraMonthly + lumpSum > 0 && (
        <div className="rounded-2xl bg-gradient-hero text-white p-5 md:p-6 relative overflow-hidden">
          <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <Sparkles className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="text-sm md:text-base leading-relaxed">
              Genom att amortera{" "}
              <span className="font-bold">{sek(extraMonthly)}</span> extra/mån
              {lumpSum > 0 && <> och betala in <span className="font-bold">{sek(lumpSum)}</span> nu</>}
              {" "}blir ni skuldfria{" "}
              <span className="font-bold">{monthDiff(sim.baselineMonths, sim.extraMonths)} tidigare</span>
              {" "}och sparar totalt{" "}
              <span className="font-bold">{sek(Math.round(interestSaving))}</span> i räntekostnader.
            </p>
          </div>
        </div>
      )}

      {/* KPI-rad */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SimKpi
          label="Skuldfri (nuläge)"
          value={monthsToLabel(sim.baselineMonths)}
          icon={<Clock className="h-4 w-4" />}
          tone="muted"
        />
        <SimKpi
          label="Skuldfri (med extra)"
          value={monthsToLabel(sim.extraMonths)}
          icon={<Clock className="h-4 w-4" />}
          tone="primary"
          highlight={extraMonthly + lumpSum > 0}
        />
        <SimKpi
          label="Tid sparad"
          value={monthDiff(sim.baselineMonths, sim.extraMonths)}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="success"
          highlight={extraMonthly + lumpSum > 0}
        />
        <SimKpi
          label="Räntebesparing"
          value={interestSaving > 0 ? sek(Math.round(interestSaving)) : "—"}
          icon={<PiggyBank className="h-4 w-4" />}
          tone="success"
          highlight={interestSaving > 0}
        />
      </div>

      {/* ROI-kort */}
      {roi != null && roi > 0 && (
        <Card className="p-4 md:p-5 rounded-2xl border-0 shadow-soft bg-success/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/15 flex items-center justify-center text-success shrink-0">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">Avkastning på extraamortering</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Varje extra krona ni amorterar ger tillbaka{" "}
                <span className="font-semibold text-foreground">{(roi + 1).toFixed(2)} kr</span>
                {" "}(inkl. kapital) — effektiv räntebesparing är{" "}
                <span className="font-semibold text-foreground">{(roi * 100).toFixed(0)}%</span> på era extra inbetalningar.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Skuldkurva */}
      {sim.series.length > 1 && (
        <Card className="p-5 rounded-2xl border-0 shadow-soft">
          <h2 className="font-display font-semibold text-base mb-4">Skuldkurva över tid</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sim.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tickFormatter={yr => `År ${yr}`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={v => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => sek(v)}
                  labelFormatter={yr => `År ${yr}`}
                />
                <Legend
                  formatter={name =>
                    name === "baseline" ? "Nuvarande plan" : "Med extraamortering"
                  }
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="baseline"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="extra"
                  name="extra"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
                {sim.extraMonths != null && (
                  <ReferenceLine
                    x={Math.ceil(sim.extraMonths / 12)}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="3 3"
                    label={{ value: "Skuldfri", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--primary))" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Räntekostnad per månad — graf */}
      {sim.series.length > 1 && (
        <Card className="p-5 rounded-2xl border-0 shadow-soft">
          <h2 className="font-display font-semibold text-base mb-1">Räntekostnad per månad — hur den sjunker</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Ju snabbare skulden minskar, desto lägre blir din månadsränta. Med extraamortering accelererar denna minskning.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sim.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tickFormatter={yr => `År ${yr}`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={v => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${sek(v)}/mån`, ""]}
                  labelFormatter={yr => `År ${yr}`}
                />
                <Legend
                  formatter={name =>
                    name === "baselineInterest" ? "Ränta — nuvarande plan" : "Ränta — med extraamortering"
                  }
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="baselineInterest"
                  name="baselineInterest"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="extraInterest"
                  name="extraInterest"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Milstolpstabell — ränta per år */}
          {interestMilestones.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 font-medium">År</th>
                    <th className="text-right pb-2 font-medium">Ränta/mån (nuläge)</th>
                    <th className="text-right pb-2 font-medium">Ränta/mån (med extra)</th>
                    <th className="text-right pb-2 font-medium">Skillnad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {interestMilestones.map(p => {
                    const diff = (p.baselineInterest ?? 0) - (p.extraInterest ?? 0);
                    return (
                      <tr key={p.year}>
                        <td className="py-2 text-muted-foreground">År {p.year}</td>
                        <td className="py-2 text-right tabular-nums">
                          {p.baselineInterest != null ? sek(p.baselineInterest) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-primary">
                          {p.extraInterest != null ? sek(p.extraInterest) : <span className="text-success font-medium">Skuldfri ✓</span>}
                        </td>
                        <td className={cn("py-2 text-right tabular-nums font-medium", diff > 0 ? "text-success" : "text-muted-foreground")}>
                          {diff > 0 ? `-${sek(diff)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Jämförelsetabell */}
      {sim.baselineMonths != null && (
        <Card className="p-5 rounded-2xl border-0 shadow-soft">
          <h2 className="font-display font-semibold text-base mb-4">Detaljerad jämförelse</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Scenario</th>
                  <th className="text-right pb-2 font-medium">Skuldfri</th>
                  <th className="text-right pb-2 font-medium">Tid kvar</th>
                  <th className="text-right pb-2 font-medium">Total ränta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr className="text-muted-foreground">
                  <td className="py-2.5 pr-4">Nuvarande plan ({sek(baseAmort)}/mån)</td>
                  <td className="py-2.5 text-right tabular-nums">{monthsToLabel(sim.baselineMonths)}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {sim.baselineMonths != null
                      ? `${Math.floor(sim.baselineMonths / 12)} år ${sim.baselineMonths % 12} mån`
                      : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{sek(Math.round(sim.baselineInterest))}</td>
                </tr>
                <tr className="font-medium text-foreground">
                  <td className="py-2.5 pr-4">
                    <span className="text-primary">✓</span> Med extra ({sek(baseAmort + extraMonthly)}/mån
                    {lumpSum > 0 && ` + ${sek(lumpSum)} nu`})
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-primary">{monthsToLabel(sim.extraMonths)}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {sim.extraMonths != null
                      ? `${Math.floor(sim.extraMonths / 12)} år ${sim.extraMonths % 12} mån`
                      : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{sek(Math.round(sim.extraInterest))}</td>
                </tr>
                {interestSaving > 0 && (
                  <tr className="text-success font-semibold bg-success/5">
                    <td className="py-2.5 pr-4 rounded-bl-lg">Besparing</td>
                    <td className="py-2.5 text-right" />
                    <td className="py-2.5 text-right tabular-nums">{monthDiff(sim.baselineMonths, sim.extraMonths)} kortare</td>
                    <td className="py-2.5 text-right tabular-nums rounded-br-lg">{sek(Math.round(interestSaving))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SimKpi({
  label,
  value,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "muted";
  highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4 md:p-5 rounded-2xl shadow-soft border-0", highlight && tone === "success" && "bg-success/5")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "success" && "bg-success/15 text-success",
          tone === "muted" && "bg-muted text-foreground",
        )}>
          {icon}
        </span>
        {label}
      </div>
      <div className={cn(
        "mt-2 text-base md:text-lg font-display font-bold",
        tone === "primary" && highlight && "text-primary",
        tone === "success" && highlight && "text-success",
      )}>
        {value}
      </div>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { lastNMonths, summarizeMonth } from "@/lib/analytics";
import { sek, monthShort, periodLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useMonthNavigator } from "@/hooks/useMonthNavigator";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area,
} from "recharts";

type Tab = "diagram" | "ar";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: 12,
};

export default function Statistics() {
  const [tab, setTab] = useState<Tab>("diagram");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Statistik</h1>
        <p className="text-sm text-muted-foreground mt-1">Förstå era pengar med ett ögonkast.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([
          { id: "diagram", label: "Diagram" },
          { id: "ar", label: "Årsöversikt" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition",
              tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "diagram" && <DiagramTab />}
      {tab === "ar" && <ArTab />}
    </div>
  );
}

// ─── Diagram ─────────────────────────────────────────────────────────────────

type PieFilter = "all" | "shared" | "private";

function DiagramTab() {
  const { state } = useBudget();
  const today = new Date();
  const { offset, monthDate, prev, next, canGoNext } = useMonthNavigator(state.settings.payDay ?? 1);
  const [pieFilter, setPieFilter] = useState<PieFilter>("all");
  const sixMonths = useMemo(() => lastNMonths(state, 6, today), [state]);
  const monthSummary = useMemo(() => summarizeMonth(state, monthDate.getFullYear(), monthDate.getMonth()), [state, offset]);

  const trendData = sixMonths.map(s => ({
    name: monthShort(new Date(s.year, s.month, 1)),
    Inkomster: s.income,
    Utgifter: s.expenses,
    Sparande: s.savings,
  }));

  const pieData = state.categories
    .map(c => {
      const shared = monthSummary.byCategory[c.id] || 0;
      const priv = monthSummary.personal.byCategory[c.id] || 0;
      const value = pieFilter === "shared" ? shared : pieFilter === "private" ? priv : shared + priv;
      return { name: c.name, value, color: `hsl(${c.color})` };
    })
    .filter(d => d.value > 0);
  const hasPrivate = monthSummary.personal.expenses > 0;

  const savingsData = sixMonths.reduce<{ name: string; total: number }[]>((acc, s, i) => {
    const prev = acc[i - 1]?.total ?? 0;
    acc.push({ name: monthShort(new Date(s.year, s.month, 1)), total: prev + s.savings });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
        <h2 className="font-display font-semibold mb-4">Trend senaste 6 månaderna</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sek(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: "hsl(var(--foreground))" }}>{v}</span>} />
              <Line type="monotone" dataKey="Inkomster" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Utgifter" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sparande" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-display font-semibold">Kategorifördelning</h2>
            <MonthNavigator label={periodLabel(monthDate, state.settings.payDay ?? 1)} onPrev={prev} onNext={next} canGoNext={canGoNext} size="sm" />
          </div>

          {hasPrivate && (
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4 text-xs">
              {([
                { id: "all", label: "Alla" },
                { id: "shared", label: "Delade" },
                { id: "private", label: "Mina privata" },
              ] as { id: PieFilter; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPieFilter(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition",
                    pieFilter === opt.id ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="h-72">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Inga utgifter</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sek(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => <span style={{ color: "hsl(var(--foreground))" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
          <h2 className="font-display font-semibold mb-4">Inkomst vs utgift</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sek(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: "hsl(var(--foreground))" }}>{v}</span>} />
                <Bar dataKey="Inkomster" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Utgifter" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
        <h2 className="font-display font-semibold mb-4">Sparutveckling (kumulativt)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsData}>
              <defs>
                <linearGradient id="savings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sek(v)} />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#savings)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ─── Årsöversikt ─────────────────────────────────────────────────────────────

function ArTab() {
  const { state } = useBudget();
  const [year, setYear] = useState(new Date().getFullYear());

  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => summarizeMonth(state, year, m)), [state, year]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = months.reduce((s, m) => s + Math.max(0, m.remaining), 0);
  const activeMonths = months.filter(m => m.income > 0 || m.expenses > 0).length || 1;

  const yearByCat: Record<string, number> = {};
  for (const m of months) for (const [k, v] of Object.entries(m.byCategory)) yearByCat[k] = (yearByCat[k] || 0) + v;
  const topCats = Object.entries(yearByCat)
    .map(([id, v]) => ({ cat: state.categories.find(c => c.id === id), value: v }))
    .filter(x => x.cat)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const maxRem = Math.max(1, ...months.map(m => Math.abs(m.remaining)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-card rounded-xl border p-1 shadow-soft w-fit">
        <Button variant="ghost" size="icon" aria-label="Föregående år" className="h-8 w-8" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-bold px-3">{year}</span>
        <Button variant="ghost" size="icon" aria-label="Nästa år" className="h-8 w-8" disabled={year >= new Date().getFullYear()} onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total inkomst", value: sek(totalIncome), tone: "success" },
          { label: "Total utgift", value: sek(totalExpense), tone: "muted" },
          { label: "Total sparande", value: sek(totalSavings), tone: "primary" },
          { label: "Snitt/månad sparat", value: sek(totalSavings / activeMonths), tone: "muted" },
        ].map(s => (
          <Card key={s.label} className="p-4 rounded-2xl shadow-soft border-0">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn(
              "mt-1 font-display font-bold text-lg md:text-xl tabular-nums",
              s.tone === "success" && "text-success",
              s.tone === "primary" && "text-primary",
            )}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
        <h2 className="font-display font-semibold mb-4">Månadsöversikt {year}</h2>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {months.map((m, i) => {
            const remRatio = m.remaining / maxRem;
            const positive = m.remaining >= 0;
            return (
              <div key={i} className="text-center">
                <div
                  className={cn(
                    "h-20 rounded-xl flex items-end p-1 border",
                    positive ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20",
                  )}
                  title={`${monthShort(new Date(year, i, 1))}: ${sek(m.remaining)}`}
                >
                  <div
                    className={cn("w-full rounded-md transition-all", positive ? "bg-success" : "bg-destructive")}
                    style={{ height: `${Math.max(4, Math.abs(remRatio) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] mt-1 text-muted-foreground capitalize">{monthShort(new Date(year, i, 1))}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 px-3 font-medium">Månad</th>
                <th className="py-2 px-3 font-medium text-right">Inkomst</th>
                <th className="py-2 px-3 font-medium text-right">Utgift</th>
                <th className="py-2 px-3 font-medium text-right">Sparande</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 px-3 capitalize">{monthShort(new Date(year, i, 1))}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{sek(m.income)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{sek(m.expenses)}</td>
                  <td className={cn("py-2 px-3 text-right tabular-nums font-medium", m.remaining >= 0 ? "text-success" : "text-destructive")}>{sek(m.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {topCats.length > 0 && (
        <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
          <h2 className="font-display font-semibold mb-4">Topp 3 kategorier {year}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {topCats.map(({ cat, value }, i) => (
              <div key={cat!.id} className="p-4 rounded-xl bg-muted/40 flex items-center gap-3">
                <div className="text-3xl font-display font-bold text-muted-foreground">#{i + 1}</div>
                <div className="text-2xl">{cat!.icon}</div>
                <div className="flex-1">
                  <div className="font-medium">{cat!.name}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">{sek(value)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Prenumerationer bor numera på Planera-sidan (SubscriptionsPanel).

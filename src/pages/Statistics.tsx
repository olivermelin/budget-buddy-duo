import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { lastNMonths, summarizeMonth, detectSubscriptions } from "@/lib/analytics";
import { sek, monthShort, monthLabel, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Repeat, Wand2, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RecurringTransaction } from "@/types/budget";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area,
} from "recharts";

type Tab = "diagram" | "ar" | "prenumerationer";

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
          { id: "prenumerationer", label: "Prenumerationer" },
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
      {tab === "prenumerationer" && <PrenumerationerTab />}
    </div>
  );
}

// ─── Diagram ─────────────────────────────────────────────────────────────────

type PieFilter = "all" | "shared" | "private";

function DiagramTab() {
  const { state } = useBudget();
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const [pieFilter, setPieFilter] = useState<PieFilter>("all");
  const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
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
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset(o => o - 1)}><ChevronLeft className="h-3 w-3" /></Button>
              <span className="text-xs font-medium px-2 min-w-[110px] text-center capitalize">{monthLabel(monthDate)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)}><ChevronRight className="h-3 w-3" /></Button>
            </div>
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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-bold px-3">{year}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={year >= new Date().getFullYear()} onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
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

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 font-medium">Månad</th>
                <th className="py-2 font-medium text-right">Inkomst</th>
                <th className="py-2 font-medium text-right">Utgift</th>
                <th className="py-2 font-medium text-right">Sparande</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 capitalize">{monthShort(new Date(year, i, 1))}</td>
                  <td className="py-2 text-right tabular-nums">{sek(m.income)}</td>
                  <td className="py-2 text-right tabular-nums">{sek(m.expenses)}</td>
                  <td className={cn("py-2 text-right tabular-nums font-medium", m.remaining >= 0 ? "text-success" : "text-destructive")}>{sek(m.remaining)}</td>
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

// ─── Prenumerationer ──────────────────────────────────────────────────────────

function PrenumerationerTab() {
  const { state, dispatch } = useBudget();
  const subs = useMemo(() => detectSubscriptions(state), [state]);
  const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));

  const recurringByDesc = useMemo(() => {
    const m = new Map<string, RecurringTransaction>();
    for (const r of state.recurringTransactions) m.set(r.description.trim().toLowerCase(), r);
    return m;
  }, [state.recurringTransactions]);

  const active = subs.filter(s => s.status === "active");
  const monthly = active.reduce((s, sub) => s + sub.amount, 0);
  const suggestions = active.filter(s => !recurringByDesc.has(s.description.trim().toLowerCase()));

  const createTemplate = (subId: string) => {
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    const matching = state.transactions.filter(t =>
      t.type === "expense" &&
      t.description.trim().toLowerCase() === sub.description.trim().toLowerCase() &&
      Math.round(t.amount) === sub.amount,
    );
    if (matching.length === 0) return;
    const days = matching.map(t => Number(t.date.slice(8, 10))).filter(n => !Number.isNaN(n));
    const dayOfMonth = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 25;
    const latest = [...matching].sort((a, b) => b.date.localeCompare(a.date))[0];
    const rt: RecurringTransaction = {
      id: crypto.randomUUID(),
      description: sub.description,
      amount: sub.amount,
      type: "expense",
      categoryId: sub.categoryId,
      payerId: latest.payerId,
      dayOfMonth: Math.min(28, Math.max(1, dayOfMonth)),
      isActive: true,
      lastGeneratedMonth: new Date().toISOString().slice(0, 7),
    };
    dispatch({ type: "UPSERT_RECURRING", rt });
    toast.success(`Mall skapad för ${sub.description}`, { description: `${sek(sub.amount)} runt dag ${rt.dayOfMonth}` });
  };

  const createAllTemplates = () => {
    if (suggestions.length === 0) { toast.info("Inga nya förslag"); return; }
    for (const s of suggestions) createTemplate(s.id);
    toast.success(`${suggestions.length} mallar skapade`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-5 rounded-2xl shadow-soft border-0">
          <div className="text-xs text-muted-foreground">Aktiva prenumerationer</div>
          <div className="text-2xl font-display font-bold mt-1">{active.length} st</div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-soft border-0 bg-gradient-primary text-white">
          <div className="text-xs opacity-80">Per månad</div>
          <div className="text-2xl font-display font-bold mt-1">{sek(monthly)}</div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-soft border-0 col-span-2 md:col-span-1">
          <div className="text-xs text-muted-foreground">Per år</div>
          <div className="text-2xl font-display font-bold mt-1 tabular-nums">{sek(monthly * 12)}</div>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="p-4 rounded-2xl border-0 shadow-soft bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{suggestions.length} förslag på återkommande mallar</span>
            </div>
            <Button size="sm" onClick={createAllTemplates} className="bg-gradient-primary rounded-xl">
              <Wand2 className="h-4 w-4" /> Skapa alla
            </Button>
          </div>
        </Card>
      )}

      <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
        {subs.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Repeat className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Inga återkommande utgifter hittades än.
          </div>
        )}
        {subs.map(sub => {
          const c = catMap[sub.categoryId];
          const hasTemplate = recurringByDesc.has(sub.description.trim().toLowerCase());
          return (
            <div key={sub.id} className="flex items-center gap-3 p-4 flex-wrap">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `hsl(${c?.color} / 0.15)` }}
              >{c?.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {sub.isPrivate && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Privat" />}
                  <span className="font-medium truncate">{sub.description}</span>
                  {sub.status === "cancelled" && <Badge variant="secondary" className="text-[10px]">Avslutad</Badge>}
                  {sub.isPrivate && <Badge variant="outline" className="text-[10px]">Privat</Badge>}
                  {hasTemplate && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" /> mall
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {sub.occurrences} mån · senast {dateLabel(sub.lastDate)} · {sek(sub.amount * 12)}/år
                </div>
              </div>
              <div className={cn("font-display font-bold tabular-nums", sub.status === "cancelled" && "line-through opacity-50")}>
                {sek(sub.amount)}
              </div>
              {!hasTemplate && sub.status === "active" && (
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => createTemplate(sub.id)}>
                  <Wand2 className="h-4 w-4" /> Skapa mall
                </Button>
              )}
              <Button
                size="sm"
                variant={sub.status === "active" ? "outline" : "default"}
                className="rounded-xl"
                onClick={() => {
                  const next = sub.status === "active" ? "cancelled" : "active";
                  dispatch({ type: "SET_SUB_STATUS", key: sub.id, status: next });
                  toast.success(next === "cancelled" ? "Markerad som avslutad" : "Aktiverad igen");
                }}
              >
                {sub.status === "active" ? "Avsluta" : "Aktivera"}
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

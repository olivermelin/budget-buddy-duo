import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { lastNMonths, summarizeMonth } from "@/lib/analytics";
import { sek, monthShort, monthLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area } from "recharts";

export default function Statistics() {
  const { state } = useBudget();
  const today = new Date();
  const [offset, setOffset] = useState(0);
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
    .map(c => ({ name: c.name, value: monthSummary.byCategory[c.id] || 0, color: `hsl(${c.color})` }))
    .filter(d => d.value > 0);

  // Cumulative savings
  const savingsData = sixMonths.reduce<{ name: string; total: number }[]>((acc, s, i) => {
    const prev = acc[i - 1]?.total ?? 0;
    acc.push({ name: monthShort(new Date(s.year, s.month, 1)), total: prev + s.savings });
    return acc;
  }, []);

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Statistik</h1>
        <p className="text-sm text-muted-foreground mt-1">Förstå era pengar med ett ögonkast.</p>
      </div>

      <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Trend senaste 6 månaderna</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sek(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Inkomster" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Utgifter" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sparande" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Kategorifördelning</h2>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset(o => o - 1)}><ChevronLeft className="h-3 w-3" /></Button>
              <span className="text-xs font-medium px-2 min-w-[110px] text-center capitalize">{monthLabel(monthDate)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)}><ChevronRight className="h-3 w-3" /></Button>
            </div>
          </div>
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
                  <Legend wrapperStyle={{ fontSize: 11 }} />
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
                <Legend wrapperStyle={{ fontSize: 12 }} />
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

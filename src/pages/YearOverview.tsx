import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { summarizeMonth } from "@/lib/analytics";
import { sek, monthShort } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function YearOverview() {
  const { state } = useBudget();
  const [year, setYear] = useState(new Date().getFullYear());

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => summarizeMonth(state, year, m));
  }, [state, year]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = months.reduce((s, m) => s + Math.max(0, m.remaining), 0);
  const activeMonths = months.filter(m => m.income > 0 || m.expenses > 0).length || 1;

  // Top categories of the year
  const yearByCat: Record<string, number> = {};
  for (const m of months) for (const [k, v] of Object.entries(m.byCategory)) yearByCat[k] = (yearByCat[k] || 0) + v;
  const topCats = Object.entries(yearByCat)
    .map(([id, v]) => ({ cat: state.categories.find(c => c.id === id), value: v }))
    .filter(x => x.cat)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const maxRem = Math.max(1, ...months.map(m => Math.abs(m.remaining)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Årsöversikt</h1>
          <p className="text-sm text-muted-foreground mt-1">Hela året i en blick.</p>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl border p-1 shadow-soft">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-bold px-3">{year}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={year >= new Date().getFullYear()} onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total inkomst" value={sek(totalIncome)} tone="success" />
        <Stat label="Total utgift" value={sek(totalExpense)} tone="muted" />
        <Stat label="Total sparande" value={sek(totalSavings)} tone="primary" />
        <Stat label="Snitt/månad sparat" value={sek(totalSavings / activeMonths)} tone="muted" />
      </div>

      <Card className="p-5 md:p-6 rounded-2xl shadow-soft border-0">
        <h2 className="font-display font-semibold mb-4">Månadsöversikt</h2>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {months.map((m, i) => {
            const remRatio = m.remaining / maxRem;
            const positive = m.remaining >= 0;
            return (
              <div key={i} className="text-center">
                <div
                  className={cn(
                    "h-20 rounded-xl flex items-end p-1 relative overflow-hidden border",
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
          {topCats.length === 0 && <div className="text-sm text-muted-foreground">Ingen data för {year}.</div>}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "success" | "muted" | "primary" }) {
  return (
    <Card className="p-4 rounded-2xl shadow-soft border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 font-display font-bold text-lg md:text-xl tabular-nums",
        tone === "success" && "text-success",
        tone === "primary" && "text-primary",
      )}>{value}</div>
    </Card>
  );
}

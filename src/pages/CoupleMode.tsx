import { useMemo, useState } from "react";
import { useBudget } from "@/store/budget-store";
import { calcSplit } from "@/lib/analytics";
import { sek, monthLabel, pct } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CoupleMode() {
  const { state, dispatch } = useBudget();
  const [offset, setOffset] = useState(0);
  const ref = new Date();
  const monthDate = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  const split = useMemo(() => calcSplit(state, monthDate.getFullYear(), monthDate.getMonth()), [state, offset]);

  const [p1, p2] = state.persons;
  const debtor = split.owesFrom;
  const creditor = split.owesTo;
  const debtorName = debtor === p1.id ? p1.name : p2.name;
  const creditorName = creditor === p1.id ? p1.name : p2.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Parläge</h1>
          <p className="text-sm text-muted-foreground mt-1">Rättvis fördelning av era utgifter.</p>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl border p-1 shadow-soft">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-2 min-w-[140px] text-center capitalize">{monthLabel(monthDate)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(["50/50", "income"] as const).map(m => (
          <button
            key={m}
            onClick={() => dispatch({ type: "UPDATE_SETTINGS", patch: { splitMode: m } })}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition", state.settings.splitMode === m ? "bg-card shadow-soft" : "text-muted-foreground")}
          >
            {m === "50/50" ? "50/50" : "Efter inkomst"}
          </button>
        ))}
      </div>

      <Card className="p-6 md:p-10 rounded-3xl shadow-elegant border-0 bg-gradient-hero text-primary-foreground overflow-hidden relative">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-wider opacity-80">Att jämna ut</p>
          {split.settlement < 1 ? (
            <p className="text-3xl font-display font-bold mt-2">Allt är jämnt 🎉</p>
          ) : (
            <>
              <p className="text-4xl md:text-5xl font-display font-extrabold mt-2 tabular-nums">{sek(split.settlement)}</p>
              <div className="mt-4 flex items-center gap-3 text-sm md:text-base">
                <Avatar name={debtorName} />
                <ArrowRight className="h-5 w-5 opacity-70" />
                <Avatar name={creditorName} />
                <span className="opacity-90 ml-2">{debtorName} ska överföra till {creditorName}</span>
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {state.persons.map(p => {
          const paid = split.paid[p.id] ?? 0;
          const share = split.share[p.id] ?? 0;
          const diff = split.diff[p.id] ?? 0;
          return (
            <Card key={p.id} className="p-6 rounded-2xl shadow-soft border-0">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} large />
                <div>
                  <div className="font-display font-semibold text-lg">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Inkomst: {sek(p.income)}/mån</div>
                </div>
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <Row label="Betalat denna månad" value={sek(paid)} />
                <Row label={`Andel (${state.settings.splitMode === "50/50" ? "50%" : pct(p.income / (state.persons[0].income + state.persons[1].income))})`} value={sek(share)} />
                <div className="border-t pt-2 mt-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className={cn("font-bold tabular-nums", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "")}>
                    {diff > 0 ? `Ligger ute med ${sek(diff)}` : diff < 0 ? `Ska betala ${sek(-diff)}` : "Jämnt"}
                  </dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <div className={cn(
      "rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-display font-bold",
      large ? "h-12 w-12 text-lg bg-primary/10 text-primary" : "h-9 w-9 text-sm"
    )}>{name.slice(0, 1).toUpperCase()}</div>
  );
}

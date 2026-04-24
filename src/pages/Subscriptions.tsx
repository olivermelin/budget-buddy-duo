import { useMemo } from "react";
import { useBudget } from "@/store/budget-store";
import { detectSubscriptions } from "@/lib/analytics";
import { sek, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Subscriptions() {
  const { state, dispatch } = useBudget();
  const subs = useMemo(() => detectSubscriptions(state), [state]);
  const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));

  const active = subs.filter(s => s.status === "active");
  const monthly = active.reduce((s, sub) => s + sub.amount, 0);
  const yearly = monthly * 12;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Prenumerationer</h1>
        <p className="text-sm text-muted-foreground mt-1">Återkommande utgifter automatiskt identifierade.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-5 rounded-2xl shadow-soft border-0">
          <div className="text-xs text-muted-foreground">Aktiva prenumerationer</div>
          <div className="text-2xl font-display font-bold mt-1">{active.length} st</div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-soft border-0 bg-gradient-primary text-primary-foreground">
          <div className="text-xs opacity-80">Per månad</div>
          <div className="text-2xl font-display font-bold mt-1">{sek(monthly)}</div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-soft border-0 col-span-2 md:col-span-1">
          <div className="text-xs text-muted-foreground">Per år</div>
          <div className="text-2xl font-display font-bold mt-1 tabular-nums">{sek(yearly)}</div>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
        {subs.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Repeat className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Inga återkommande utgifter hittades än. Lägg till transaktioner under flera månader för att hitta mönster.
          </div>
        )}
        {subs.map(sub => {
          const c = catMap[sub.categoryId];
          return (
            <div key={sub.id} className="flex items-center gap-3 p-4">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `hsl(${c?.color} / 0.15)` }}
              >{c?.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{sub.description}</span>
                  {sub.status === "cancelled" && <Badge variant="secondary" className="text-[10px]">Avslutad</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {sub.occurrences} mån · senast {dateLabel(sub.lastDate)} · {sek(sub.amount * 12)}/år
                </div>
              </div>
              <div className={cn("font-display font-bold tabular-nums", sub.status === "cancelled" && "line-through opacity-50")}>{sek(sub.amount)}</div>
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

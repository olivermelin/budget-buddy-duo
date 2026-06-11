import { useMemo } from "react";
import { useBudget } from "@/store/budget-store";
import { detectSubscriptions } from "@/lib/analytics";
import { sek, dateLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Repeat, Wand2, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RecurringTransaction } from "@/types/budget";

// Prenumerationer härleds ur transaktionshistoriken (detectSubscriptions) och
// visas tillsammans med budgeten på Planera-sidan.
export function SubscriptionsPanel() {
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
  const hasTemplate = (s: typeof subs[number]) => recurringByDesc.has(s.description.trim().toLowerCase());
  const suggestions = active.filter(s => !hasTemplate(s));
  const unplanned = subs.filter(s => !hasTemplate(s));
  const planned = subs.filter(s => hasTemplate(s));

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

      {subs.length === 0 && (
        <Card className="rounded-2xl shadow-soft border-0 overflow-hidden">
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Repeat className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Inga återkommande utgifter hittades än.
          </div>
        </Card>
      )}

      {unplanned.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold">Oplanerade</h3>
            <span className="text-xs text-muted-foreground">saknar återkommande mall</span>
          </div>
          <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
            {unplanned.map(renderRow)}
          </Card>
        </div>
      )}

      {planned.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold">Redan planerade</h3>
            <span className="text-xs text-muted-foreground">har en återkommande mall i Budget</span>
          </div>
          <Card className="rounded-2xl shadow-soft border-0 overflow-hidden divide-y divide-border">
            {planned.map(renderRow)}
          </Card>
        </div>
      )}
    </div>
  );

  function renderRow(sub: typeof subs[number]) {
    const c = catMap[sub.categoryId];
    const templated = hasTemplate(sub);
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
            {templated && (
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
        {!templated && sub.status === "active" && (
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
  }
}

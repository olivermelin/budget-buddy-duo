import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useBudget } from "@/store/budget-store";
import { computeFinancialHealth, type FinancialHealth as FinancialHealthResult, HealthFinding, HealthScenario, HealthStatus } from "@/lib/financial-health";
import { currentPeriodMonth } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { sek, periodLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HeartPulse, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Info, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Deterministisk sammanfattning som visas om AI-lagret inte är tillgängligt.
function buildFallbackAdvice(h: FinancialHealthResult): string {
  const worst = h.findings.find(f => f.status === "bad") ?? h.findings.find(f => f.status === "warn");
  const intro = h.grade === "Utmärkt"
    ? "Er ekonomi ser riktigt stark ut."
    : h.grade === "Bra"
      ? "Er ekonomi är på god väg."
      : h.grade === "Okej"
        ? "Er ekonomi är okej men har tydlig förbättringspotential."
        : "Er ekonomi behöver en översyn.";
  const next = worst
    ? ` Störst effekt får ni av att ${(worst.action ?? worst.title).charAt(0).toLowerCase()}${(worst.action ?? worst.title).slice(1)}`
    : " Fortsätt med era goda vanor.";
  return intro + next;
}

const STATUS_STYLES: Record<HealthStatus, { card: string; icon: typeof Info; iconColor: string }> = {
  good: { card: "bg-success-soft", icon: CheckCircle2, iconColor: "text-success" },
  warn: { card: "bg-warning-soft", icon: AlertTriangle, iconColor: "text-warning" },
  bad: { card: "bg-destructive/10", icon: AlertTriangle, iconColor: "text-destructive" },
};

const scoreColor = (score: number) =>
  score >= 80 ? "text-success" : score >= 60 ? "text-primary" : score >= 40 ? "text-warning" : "text-destructive";
const barColor = (score: number) =>
  score >= 80 ? "bg-success" : score >= 60 ? "bg-primary" : score >= 40 ? "bg-warning" : "bg-destructive";

export default function FinancialHealth() {
  const { state } = useBudget();
  // Lönedagsmedveten innevarande period — samma definition som resten av appen.
  const periodDate = useMemo(() => currentPeriodMonth(state.settings.payDay ?? 1), [state.settings.payDay]);
  const health = useMemo(() => computeFinancialHealth(state, periodDate), [state, periodDate]);

  const [advice, setAdvice] = useState<{ text: string; source: "ai" | "fallback" } | null>(null);
  const [loading, setLoading] = useState(true);
  // Nyckel som bara ändras när själva bilden ändras — undviker att anropa AI vid varje render.
  const adviceKey = useMemo(
    () => `${health.score}|${health.findings.map(f => `${f.id}:${f.status}`).join(",")}`,
    [health],
  );
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === adviceKey) return;
    lastKey.current = adviceKey;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("financial-health-advice", {
          body: {
            score: health.score,
            grade: health.grade,
            basis: health.basis,
            findings: health.findings.map(f => ({
              status: f.status, title: f.title, detail: f.detail, source: f.source, action: f.action,
              scenarios: f.scenarios?.map(s => ({ label: s.label, detail: s.detail })),
            })),
          },
        });
        if (error) throw error;
        const text = (data as { advice?: string } | null)?.advice;
        if (!text) throw new Error("Tomt svar");
        if (!cancelled) setAdvice({ text, source: "ai" });
      } catch {
        if (!cancelled) setAdvice({ text: buildFallbackAdvice(health), source: "fallback" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adviceKey, health]);

  const noData = health.findings.some(f => f.id === "no-income");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{periodLabel(periodDate, state.settings.payDay ?? 1)}</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold mt-1 flex items-center gap-3">
          <HeartPulse className="h-8 w-8 text-primary" /> Ekonomisk hälsa
        </h1>
      </div>

      {/* Hero: score */}
      <Card className="relative overflow-hidden border-0 bg-gradient-hero text-white p-6 md:p-10 rounded-3xl shadow-elegant animate-in-up">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-6 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-6xl md:text-7xl font-display font-extrabold tracking-tight tabular-nums">{health.score}</span>
            <span className="text-2xl font-display font-bold opacity-70">/100</span>
          </div>
          <div>
            <Badge variant="secondary" className="text-sm">{health.grade}</Badge>
            <p className="mt-2 text-sm opacity-80 max-w-md">
              {noData
                ? "Fyll i era inkomster för att få en rättvis bedömning."
                : "Sammanvägd hälsa av sparkvot, fasta utgifter, skuldbörda och rörliga utgifter — mätt mot etablerade riktmärken."}
            </p>
          </div>
        </div>
      </Card>

      {/* AI-sammanfattning */}
      <Card className="p-5 md:p-6 rounded-2xl border-0 shadow-soft bg-accent">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Sammanfattning</h2>
          {advice?.source === "ai" && <Badge variant="outline" className="text-[10px]">AI</Badge>}
        </div>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-foreground/10 rounded w-3/4" />
            <div className="h-3 bg-foreground/10 rounded w-1/2" />
          </div>
        ) : (
          <p className="text-sm text-balance">{advice?.text}</p>
        )}
      </Card>

      {/* Delpoäng per område */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {health.areas.map(a => (
          <Card key={a.area} className="p-4 md:p-5 rounded-2xl shadow-soft border-0 bg-card">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{a.label}</span>
              <span>{a.weight}%</span>
            </div>
            <div className={cn("mt-2 text-2xl md:text-3xl font-display font-bold tabular-nums", scoreColor(a.score))}>
              {a.score}
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", barColor(a.score))} style={{ width: `${a.score}%` }} />
            </div>
          </Card>
        ))}
      </div>

      {/* Åtgärdslista */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Rekommendationer</h2>
        </div>
        <div className="space-y-3">
          {health.findings.map(f => (
            <FindingRow key={f.id} f={f} />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Riktmärkena bygger på 50/30/20-regeln, Konsumentverket och Finansinspektionens vägledning.
        Detta är generell vägledning, inte personlig finansiell rådgivning.
      </p>
    </div>
  );
}

function FindingRow({ f }: { f: HealthFinding }) {
  const style = STATUS_STYLES[f.status];
  const Icon = style.icon;
  const linkToBudget = f.id === "subscriptions";
  return (
    <Card className={cn("p-4 md:p-5 rounded-2xl border-0 shadow-soft", style.card)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{f.title}</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] cursor-help">{f.source}</Badge>
              </TooltipTrigger>
              <TooltipContent>Riktmärke: {f.source}</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{f.detail}</p>
          {f.action && (
            <p className="text-sm font-medium mt-2 flex items-start gap-1.5">
              <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              {linkToBudget
                ? <Link to="/budget" className="hover:underline">{f.action}</Link>
                : <span>{f.action}</span>}
            </p>
          )}
          {f.scenarios && f.scenarios.length > 0 && (
            <ul className="mt-3 space-y-2">
              {f.scenarios.map(s => <ScenarioRow key={s.label} s={s} />)}
            </ul>
          )}
        </div>
        {f.impact != null && f.impact >= 1 && (
          <div className="text-right shrink-0">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Effekt</div>
            <div className="font-display font-bold text-sm tabular-nums">{sek(f.impact)}/mån</div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Djuplänk till amorteringssimulatorn med förslaget förifyllt.
function scenarioHref(s: HealthScenario): string | null {
  if (!s.sim) return null;
  const p = new URLSearchParams({ tab: "simulator", loanId: s.sim.loanId });
  if (s.sim.extra) p.set("extra", String(s.sim.extra));
  if (s.sim.lump) p.set("lump", String(s.sim.lump));
  return `/loans?${p.toString()}`;
}

function ScenarioRow({ s }: { s: HealthScenario }) {
  const href = scenarioHref(s);
  const body = (
    <>
      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
      <span className="flex-1">
        <span className="font-medium">{s.label}.</span>{" "}
        <span className="text-muted-foreground">{s.detail}</span>
      </span>
      {href && (
        <span className="ml-auto shrink-0 flex items-center gap-0.5 text-xs font-medium text-primary">
          Simulera <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </>
  );
  const base = "text-sm flex items-start gap-2 rounded-xl bg-background/60 p-2.5";
  return href ? (
    <li>
      <Link to={href} className={cn(base, "transition-colors hover:bg-background")}>{body}</Link>
    </li>
  ) : (
    <li className={base}>{body}</li>
  );
}

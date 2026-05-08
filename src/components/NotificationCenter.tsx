import { useMemo, useState, useEffect } from "react";
import { Bell, Check, X, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBudget } from "@/store/budget-store";
import { buildNotifications, loadDismissed, saveDismissed, type AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const severityIcon = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
} as const;

const severityClass = {
  info: "text-primary",
  warning: "text-warning",
  success: "text-success",
} as const;

export function NotificationCenter() {
  const { state } = useBudget();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  const all = useMemo(() => buildNotifications(state), [state]);
  const visible = useMemo(() => all.filter(n => !dismissed.has(n.id)), [all, dismissed]);

  useEffect(() => {
    // Rensa bort dismissed-IDn som inte längre genereras (städar localStorage)
    const liveIds = new Set(all.map(n => n.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of dismissed) {
      if (liveIds.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) {
      setDismissed(next);
      saveDismissed(next);
    }
  }, [all, dismissed]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const dismissAll = () => {
    const next = new Set<string>([...dismissed, ...visible.map(n => n.id)]);
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          aria-label={`Notifieringar (${visible.length})`}
        >
          <Bell className="h-4 w-4" />
          {visible.length > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {visible.length > 9 ? "9+" : visible.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-display font-semibold">Notifieringar</div>
          {visible.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissAll}>
              <Check className="h-3 w-3" /> Markera alla
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {visible.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Inga nya notifieringar
            </div>
          )}
          {visible.map(n => (
            <NotificationRow
              key={n.id}
              notification={n}
              onDismiss={() => dismiss(n.id)}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  notification: n,
  onDismiss,
  onNavigate,
}: {
  notification: AppNotification;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  const Icon = severityIcon[n.severity];
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    n.href ? (
      <Link to={n.href} onClick={onNavigate} className="flex-1 min-w-0">{children}</Link>
    ) : (
      <div className="flex-1 min-w-0">{children}</div>
    );
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", severityClass[n.severity])} />
      <Wrapper>
        <div className="text-sm font-medium">{n.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{n.description}</div>
      </Wrapper>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
        onClick={onDismiss}
        aria-label="Avfärda"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

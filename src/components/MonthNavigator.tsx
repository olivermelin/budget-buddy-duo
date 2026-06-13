import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonthNavigatorProps {
  /** Färdigformaterad etikett, t.ex. monthLabel(monthDate) eller periodLabel(monthDate, payDay). */
  label: string;
  onPrev: () => void;
  onNext: () => void;
  /** Framåtknappen avaktiveras när detta är falskt (appen visar aldrig framtida månader). */
  canGoNext: boolean;
  /** "md" (kort med ram) används på Planera/Fördelning, "sm" (kompakt) i diagramkort. */
  size?: "sm" | "md";
}

export function MonthNavigator({ label, onPrev, onNext, canGoNext, size = "md" }: MonthNavigatorProps) {
  const sm = size === "sm";
  return (
    <div className={cn("flex items-center gap-1", sm ? "bg-muted rounded-lg p-0.5" : "bg-card rounded-xl border p-1 shadow-soft")}>
      <Button variant="ghost" size="icon" className={sm ? "h-7 w-7" : "h-8 w-8"} onClick={onPrev} aria-label="Föregående månad">
        <ChevronLeft className={sm ? "h-3 w-3" : "h-4 w-4"} />
      </Button>
      <span className={cn("font-medium text-center capitalize", sm ? "text-xs px-2 min-w-[110px]" : "text-sm px-3 min-w-[140px]")}>{label}</span>
      <Button variant="ghost" size="icon" className={sm ? "h-7 w-7" : "h-8 w-8"} disabled={!canGoNext} onClick={onNext} aria-label="Nästa månad">
        <ChevronRight className={sm ? "h-3 w-3" : "h-4 w-4"} />
      </Button>
    </div>
  );
}

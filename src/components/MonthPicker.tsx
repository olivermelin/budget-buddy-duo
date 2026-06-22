import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

interface MonthPickerProps {
  value: string; // "YYYY-MM" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MonthPicker({ value, onChange, placeholder = "Välj månad", className }: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedYear = value ? Number(value.split("-")[0]) : null;
  const selectedMonth = value ? Number(value.split("-")[1]) : null;

  const [viewYear, setViewYear] = useState(() => selectedYear ?? new Date().getFullYear());

  const displayText = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null;
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return d.toLocaleDateString("sv-SE", { year: "numeric", month: "long" });
  }, [selectedYear, selectedMonth]);

  const pick = (month: number) => {
    const val = `${viewYear}-${String(month).padStart(2, "0")}`;
    onChange(val);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(selectedYear ?? new Date().getFullYear()); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
          {displayText ? <span className="capitalize">{displayText}</span> : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {/* Årnavigering */}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" aria-label="Föregående år" className="h-7 w-7" onClick={() => setViewYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
          <Button variant="ghost" size="icon" aria-label="Nästa år" className="h-7 w-7" onClick={() => setViewYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Månadsgrid */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, i) => {
            const month = i + 1;
            const isSelected = selectedYear === viewYear && selectedMonth === month;
            return (
              <button
                key={month}
                type="button"
                onClick={() => pick(month)}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

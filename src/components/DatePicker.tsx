import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

const DAY_HEADERS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

interface DatePickerProps {
  /** ISO-sträng "YYYY-MM-DD" eller "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Måndag = 0, Söndag = 6 */
function startDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // omvandla söndag=0 → 6
}

export function DatePicker({ value, onChange, placeholder = "Välj datum", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = value ? new Date(value) : null;
  const selYear = parsed?.getFullYear() ?? null;
  const selMonth = parsed ? parsed.getMonth() : null;
  const selDay = parsed?.getDate() ?? null;

  const [viewYear, setViewYear] = useState(() => selYear ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selMonth ?? new Date().getMonth());

  const displayText = parsed
    ? parsed.toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const days = daysInMonth(viewYear, viewMonth);
  const offset = startDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const pick = (day: number) => {
    onChange(toIso(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  };

  const isToday = (day: number) => {
    const now = new Date();
    return viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate();
  };

  const isSelected = (day: number) =>
    selYear === viewYear && selMonth === viewMonth && selDay === day;

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setViewYear(selYear ?? new Date().getFullYear());
        setViewMonth(selMonth ?? new Date().getMonth());
      }
    }}>
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
          {displayText ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {/* Månadsnavigering */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" aria-label="Föregående månad" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <Button variant="ghost" size="icon" aria-label="Nästa månad" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Veckodagsrubriker */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Daggrid */}
        <div className="grid grid-cols-7">
          {/* Tomma celler före första dagen */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}
          {/* Dagar */}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            return (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                className={cn(
                  "h-8 w-full rounded-md text-sm transition-colors",
                  isSelected(day)
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : isToday(day)
                      ? "bg-accent font-semibold"
                      : "hover:bg-accent",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Snabbknappar */}
        <div className="flex gap-1 mt-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => { onChange(toIso(new Date())); setOpen(false); }}
          >
            Idag
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

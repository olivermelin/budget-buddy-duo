import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "sidebar" | "compact";
}

export function GroupSwitcher({ className, variant = "sidebar" }: Props) {
  const { households, householdId, switchHousehold } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const current = households.find(h => h.id === householdId);
  const label = current?.name ?? "Välj grupp";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Byt grupp"
          className={cn(
            "flex items-center gap-2 w-full text-left rounded-lg transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            variant === "sidebar" ? "px-2 py-1.5" : "px-2 py-1",
            className,
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              "truncate font-medium",
              variant === "sidebar" ? "text-xs text-muted-foreground" : "text-sm",
            )}>
              {variant === "sidebar" ? "Aktiv grupp" : "Grupp"}
            </div>
            <div className={cn(
              "truncate",
              variant === "sidebar" ? "text-sm text-foreground" : "text-xs text-muted-foreground",
            )}>
              {label}
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5 rounded-2xl">
        <div className="px-2 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Mina grupper
        </div>
        <ul className="space-y-0.5" role="listbox" aria-label="Välj grupp">
          {households.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">Inga grupper än.</li>
          )}
          {households.map(h => {
            const selected = h.id === householdId;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    switchHousehold(h.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-left transition-colors",
                    selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent",
                  )}
                >
                  <span className="flex-1 truncate">{h.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 pt-1 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/onboarding");
            }}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-left hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Skapa eller gå med i ny grupp</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

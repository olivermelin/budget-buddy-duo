import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, PiggyBank, Receipt, Users, Target, BarChart3, CalendarRange, Repeat, Settings, Plus, Moon, Sun, Wallet } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/store/budget-store";
import { TransactionModal } from "@/components/TransactionModal";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Översikt", icon: LayoutDashboard, end: true },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/transaktioner", label: "Transaktioner", icon: Receipt },
  { to: "/parlage", label: "Parläge", icon: Users },
  { to: "/sparmal", label: "Sparmål", icon: Target },
  { to: "/statistik", label: "Statistik", icon: BarChart3 },
  { to: "/arsoversikt", label: "Årsöversikt", icon: CalendarRange },
  { to: "/prenumerationer", label: "Prenumerationer", icon: Repeat },
  { to: "/installningar", label: "Inställningar", icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useBudget();
  const location = useLocation();
  const isDark = document.documentElement.classList.contains("dark");

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    dispatch({ type: "UPDATE_SETTINGS", patch: { theme: next } });
  };

  const pageTitle = nav.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))?.label ?? "";

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col md:flex-row w-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">BudgetBuddy</div>
            <div className="text-xs text-muted-foreground mt-1">{state.settings.householdName}</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              activeClassName="!bg-primary !text-primary-foreground shadow-soft"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button onClick={() => setOpen(true)} className="w-full bg-gradient-primary hover:opacity-90 shadow-soft rounded-xl h-11">
            <Plus className="h-4 w-4" /> Ny utgift
          </Button>
          <Button variant="ghost" onClick={toggleTheme} className="w-full rounded-xl">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Ljust läge" : "Mörkt läge"}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="font-display font-bold">{pageTitle || "BudgetBuddy"}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button onClick={() => setOpen(true)} size="sm" className="bg-gradient-primary rounded-xl h-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-6xl w-full mx-auto animate-fade">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-lg border-t border-border">
          <div className="flex overflow-x-auto no-scrollbar px-2">
            {nav.slice(0, 5).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[64px] py-2.5 text-[10px] font-medium text-muted-foreground"
                activeClassName="!text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <TransactionModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

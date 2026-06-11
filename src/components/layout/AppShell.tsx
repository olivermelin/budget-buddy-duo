import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, PiggyBank, Receipt, Users, Target, BarChart3, Settings, Plus, Moon, Sun, Wallet, LogOut, MoreHorizontal, Landmark } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { TransactionModal } from "@/components/TransactionModal";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Primär navigation: de fyra ytor man använder dagligen/veckovis.
// Allt annat (sparmål, lån, statistik, inställningar) ligger under "Mer".
const primaryNav = [
  { to: "/", label: "Översikt", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transaktioner", icon: Receipt },
  { to: "/budget", label: "Planera", icon: PiggyBank, end: false },
  { to: "/couple", label: "Fördelning", icon: Users, end: false },
];

const overflowNav = [
  { to: "/goals", label: "Sparmål", icon: Target, end: false },
  { to: "/loans", label: "Lån", icon: Landmark, end: false },
  { to: "/statistics", label: "Statistik", icon: BarChart3, end: false },
  { to: "/settings", label: "Inställningar", icon: Settings, end: false },
];

const nav = [...primaryNav, ...overflowNav];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { state, dispatch } = useBudget();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isDark = document.documentElement.classList.contains("dark");
  const inOverflow = overflowNav.some(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to));
  const userLabel =
    user?.user_metadata?.given_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    dispatch({ type: "UPDATE_SETTINGS", patch: { theme: next } });
  };

  const pageTitle = nav.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))?.label ?? "";

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col md:flex-row w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:font-medium"
      >
        Hoppa till innehåll
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        <div className="px-4 pt-6 pb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div className="font-display font-bold text-lg leading-none flex-1">BudgetBuddy</div>
          <NotificationCenter />
        </div>
        <div className="px-3 pb-3">
          <GroupSwitcher />
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {primaryNav.map(item => (
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
          <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mer</div>
          {overflowNav.map(item => (
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
          {userLabel && (
            <div className="flex items-center justify-between gap-2 px-3 pt-2 mt-1 border-t border-sidebar-border">
              <span className="text-xs text-muted-foreground truncate">{userLabel}</span>
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
                aria-label="Logga ut"
              >
                <LogOut className="h-3 w-3" /> Logga ut
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div className="font-display font-bold">{pageTitle || "BudgetBuddy"}</div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label={isDark ? "Byt till ljust läge" : "Byt till mörkt läge"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button onClick={() => setOpen(true)} size="sm" className="bg-gradient-primary rounded-xl h-9" aria-label="Lägg till transaktion">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-6xl w-full mx-auto animate-fade">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-lg border-t border-border" aria-label="Huvudnavigering">
          <div className="flex px-2">
            {primaryNav.map(item => (
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
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 min-w-[64px] py-2.5 text-[10px] font-medium",
                    inOverflow ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-label="Fler menyalternativ"
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span>Mer</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl pb-8">
                <SheetHeader className="text-left">
                  <SheetTitle className="font-display">Meny</SheetTitle>
                </SheetHeader>
                <div className="mt-3 p-2 rounded-xl border border-border">
                  <GroupSwitcher variant="compact" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {overflowNav.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      activeClassName="!bg-primary !text-primary-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  {userLabel && (
                    <div className="flex items-center justify-between gap-2 px-2">
                      <span className="text-xs text-muted-foreground truncate">Inloggad som <span className="text-foreground font-medium">{userLabel}</span></span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { setMoreOpen(false); signOut(); }}
                    className="w-full rounded-xl"
                  >
                    <LogOut className="h-4 w-4" /> Logga ut
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      <TransactionModal open={open} onOpenChange={setOpen} />
      <OfflineIndicator />
    </div>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BudgetProvider } from "@/store/budget-store";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireHousehold } from "@/components/RequireHousehold";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Budget from "./pages/Budget";
import Transactions from "./pages/Transactions";
import CoupleMode from "./pages/CoupleMode";
import Goals from "./pages/Goals";
import Loans from "./pages/Loans";
import Import from "./pages/Import";
import Statistics from "./pages/Statistics";
import YearOverview from "./pages/YearOverview";
import Subscriptions from "./pages/Subscriptions";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BudgetProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <Onboarding />
                  </RequireAuth>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <RequireHousehold>
                      <AppShell />
                    </RequireHousehold>
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/transaktioner" element={<Transactions />} />
                <Route path="/parlage" element={<CoupleMode />} />
                <Route path="/sparmal" element={<Goals />} />
                <Route path="/lan" element={<Loans />} />
                <Route path="/import" element={<Import />} />
                <Route path="/statistik" element={<Statistics />} />
                <Route path="/arsoversikt" element={<YearOverview />} />
                <Route path="/prenumerationer" element={<Subscriptions />} />
                <Route path="/installningar" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BudgetProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

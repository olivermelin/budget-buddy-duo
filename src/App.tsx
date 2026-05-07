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
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
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
              <Route path="/integritetspolicy" element={<PrivacyPolicy />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <ErrorBoundary>
                      <Onboarding />
                    </ErrorBoundary>
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
                <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="/budget" element={<ErrorBoundary><Budget /></ErrorBoundary>} />
                <Route path="/transaktioner" element={<ErrorBoundary><Transactions /></ErrorBoundary>} />
                <Route path="/parlage" element={<ErrorBoundary><CoupleMode /></ErrorBoundary>} />
                <Route path="/sparmal" element={<ErrorBoundary><Goals /></ErrorBoundary>} />
                <Route path="/lan" element={<ErrorBoundary><Loans /></ErrorBoundary>} />
                <Route path="/import" element={<ErrorBoundary><Import /></ErrorBoundary>} />
                <Route path="/statistik" element={<ErrorBoundary><Statistics /></ErrorBoundary>} />
                <Route path="/arsoversikt" element={<ErrorBoundary><YearOverview /></ErrorBoundary>} />
                <Route path="/prenumerationer" element={<ErrorBoundary><Subscriptions /></ErrorBoundary>} />
                <Route path="/installningar" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
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

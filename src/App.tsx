import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import Statistics from "./pages/Statistics";
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
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/integritetspolicy" element={<Navigate to="/privacy-policy" replace />} />
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
                <Route path="/transactions" element={<ErrorBoundary><Transactions /></ErrorBoundary>} />
                <Route path="/couple" element={<ErrorBoundary><CoupleMode /></ErrorBoundary>} />
                <Route path="/goals" element={<ErrorBoundary><Goals /></ErrorBoundary>} />
                <Route path="/loans" element={<ErrorBoundary><Loans /></ErrorBoundary>} />
                <Route path="/statistics" element={<ErrorBoundary><Statistics /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                {/* Redirects för gamla svenska URL:er */}
                <Route path="/transaktioner" element={<Navigate to="/transactions" replace />} />
                <Route path="/parlage" element={<Navigate to="/couple" replace />} />
                <Route path="/sparmal" element={<Navigate to="/goals" replace />} />
                <Route path="/lan" element={<Navigate to="/loans" replace />} />
                <Route path="/statistik" element={<Navigate to="/statistics" replace />} />
                <Route path="/installningar" element={<Navigate to="/settings" replace />} />
                <Route path="/arsoversikt" element={<Navigate to="/statistics" replace />} />
                <Route path="/prenumerationer" element={<Navigate to="/statistics" replace />} />
                <Route path="/import" element={<Navigate to="/settings" replace />} />
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

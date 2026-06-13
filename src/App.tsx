import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BudgetProvider } from "@/store/budget-store";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireHousehold } from "@/components/RequireHousehold";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Sidorna laddas lazy så att startbygget bara innehåller skalet + första sidan.
// Tunga sidor (Statistik/recharts, Lån/simulator, Inställningar/export) hamnar
// i egna chunks som hämtas först när rutten besöks.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Budget = lazy(() => import("./pages/Budget"));
const Transactions = lazy(() => import("./pages/Transactions"));
const CoupleMode = lazy(() => import("./pages/CoupleMode"));
const Goals = lazy(() => import("./pages/Goals"));
const Loans = lazy(() => import("./pages/Loans"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
    <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse">
      <Wallet className="h-6 w-6 text-white" />
    </div>
  </div>
);

const App = () => (
  <AuthProvider>
    <BudgetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
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
                <Route path="/prenumerationer" element={<Navigate to="/budget" replace />} />
                <Route path="/planera" element={<Navigate to="/budget" replace />} />
                <Route path="/import" element={<Navigate to="/settings" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </BudgetProvider>
  </AuthProvider>
);

export default App;

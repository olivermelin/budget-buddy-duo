import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Wallet } from "lucide-react";

export function RequireHousehold({ children }: { children: React.ReactNode }) {
  const { householdId, householdLoading } = useAuth();

  if (householdLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!householdId) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

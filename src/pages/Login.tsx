import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const features = [
  { icon: TrendingUp, label: "Realtidsöversikt", desc: "Se gruppens ekonomi live" },
  { icon: Users, label: "Delad ekonomi", desc: "Fördela utgifter rättvist mellan medlemmar" },
  { icon: Shield, label: "Säkert & privat", desc: "Data lagras krypterat i EU" },
];

export default function Login() {
  const { session, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm animate-in-up">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-display font-bold text-3xl text-foreground tracking-tight">
              BudgetBuddy
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ekonomin — tillsammans
            </p>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-2xl shadow-soft p-8 flex flex-col gap-6">
            <div className="text-center">
              <h2 className="font-display font-semibold text-xl text-foreground">
                Välkommen tillbaka
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Logga in för att se er gemensamma ekonomi
              </p>
            </div>

            <Button
              onClick={signInWithGoogle}
              variant="outline"
              className="w-full h-12 rounded-xl border-border font-medium flex items-center gap-3 hover:bg-accent transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Fortsätt med Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Genom att logga in godkänner du våra{" "}
              <a href="/villkor" className="underline hover:text-foreground transition-colors">villkor</a> och{" "}
              <a href="/integritetspolicy" className="underline hover:text-foreground transition-colors">integritetspolicy</a>.
            </p>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-card border border-border shadow-soft">
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground">
        BudgetBuddy · Data lagras i EU (Stockholm)
      </footer>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the code exchange automatically (detectSessionInUrl: true).
    // We just wait for the session to appear via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });

    // Also check if session is already set (race condition: event may have fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });

    const fallback = setTimeout(() => navigate("/login", { replace: true }), 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
      <div className="flex flex-col items-center gap-4 animate-fade">
        <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <Wallet className="h-7 w-7 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">Loggar in…</p>
        <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-primary rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}

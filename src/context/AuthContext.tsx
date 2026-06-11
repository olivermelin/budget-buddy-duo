import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface HouseholdSummary {
  id: string;
  name: string;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  households: HouseholdSummary[];
  householdId: string | null;
  householdLoading: boolean;
  refreshHousehold: () => Promise<void>;
  switchHousehold: (id: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVE_HH_KEY = "budgetbuddy.activeHouseholdId";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdId, setHouseholdIdState] = useState<string | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);

  const persistActive = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(ACTIVE_HH_KEY, id);
      else localStorage.removeItem(ACTIVE_HH_KEY);
    } catch { /* ignore */ }
  }, []);

  const fetchHouseholds = useCallback(async (userId: string) => {
    setHouseholdLoading(true);
    const { data } = await supabase
      .from("household_members")
      .select("household_id, households(name)")
      .eq("user_id", userId);

    type Row = { household_id: string; households: { name: string } | { name: string }[] | null };
    const rows = (data ?? []) as unknown as Row[];

    const list: HouseholdSummary[] = rows.map(r => {
      const h = r.households;
      const name = Array.isArray(h) ? (h[0]?.name ?? "Grupp") : (h?.name ?? "Grupp");
      return { id: r.household_id, name };
    });

    setHouseholds(list);

    let saved: string | null = null;
    try { saved = localStorage.getItem(ACTIVE_HH_KEY); } catch { /* ignore */ }

    const validSaved = saved && list.some(h => h.id === saved) ? saved : null;
    const next = validSaved ?? list[0]?.id ?? null;

    setHouseholdIdState(next);
    persistActive(next);
    setHouseholdLoading(false);
  }, [persistActive]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchHouseholds(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchHouseholds(session.user.id);
      else {
        setHouseholds([]);
        setHouseholdIdState(null);
        persistActive(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchHouseholds, persistActive]);

  const refreshHousehold = useCallback(async () => {
    if (session) await fetchHouseholds(session.user.id);
  }, [session, fetchHouseholds]);

  const switchHousehold = useCallback((id: string) => {
    // Fynd 10: validera mot känd lista – förhindrar localStorage-manipulation
    if (!households.some(h => h.id === id)) return;
    setHouseholdIdState(id);
    persistActive(id);
  }, [households, persistActive]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  // Magic link: skickar en inloggningslänk via e-post. Nya användare skapas automatiskt.
  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        households,
        householdId,
        householdLoading,
        refreshHousehold,
        switchHousehold,
        signInWithGoogle,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  householdId: string | null;
  householdLoading: boolean;
  refreshHousehold: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);

  const fetchHousehold = useCallback(async (userId: string) => {
    setHouseholdLoading(true);
    const { data } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();
    setHouseholdId(data?.household_id ?? null);
    setHouseholdLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchHousehold(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchHousehold(session.user.id);
      else setHouseholdId(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchHousehold]);

  const refreshHousehold = useCallback(async () => {
    if (session) await fetchHousehold(session.user.id);
  }, [session, fetchHousehold]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, householdId, householdLoading, refreshHousehold, signInWithGoogle, signOut }}
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

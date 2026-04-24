import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Home, Users, Copy, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type Mode = "choose" | "create" | "join" | "created";

export default function Onboarding() {
  const { user, signOut, refreshHousehold } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!householdName.trim() || !user) return;
    setLoading(true);
    setError("");

    // Generate UUID client-side to avoid insert().select() RLS conflict
    // (SELECT policy requires membership which doesn't exist yet at insert time)
    const householdId = crypto.randomUUID();
    const { error: hErr } = await supabase
      .from("households")
      .insert({ id: householdId, name: householdName.trim() });

    if (hErr) {
      setError("Kunde inte skapa hushåll. Försök igen.");
      setLoading(false);
      return;
    }

    const displayName =
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Person 1";

    const { error: mErr } = await supabase.from("household_members").insert({
      household_id: householdId,
      user_id: user.id,
      display_name: displayName,
      role: "owner",
      person_color: "#1e3a5f",
    });

    if (mErr) {
      setError("Kunde inte lägga till dig i hushållet.");
      setLoading(false);
      return;
    }

    await supabase.rpc("seed_default_categories", { hid: householdId });

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await supabase.from("household_invites").insert({
      household_id: householdId,
      invite_code: code,
      created_by: user.id,
    });

    setGeneratedCode(code);
    await refreshHousehold();
    setMode("created");
    setLoading(false);
  };

  const handleJoin = async () => {
    if (inviteCode.trim().length < 6 || !user) return;
    setLoading(true);
    setError("");

    const { data, error: rpcErr } = await supabase.rpc("join_household", {
      code: inviteCode.trim().toUpperCase(),
    });

    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Ogiltig eller utgången inbjudningskod.");
      setLoading(false);
      return;
    }

    await refreshHousehold();
    navigate("/", { replace: true });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm animate-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-3">
            <Wallet className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">Kom igång</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hej {user?.user_metadata?.given_name ?? user?.email?.split("@")[0]}! Skapa eller gå med i ett hushåll.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-soft p-6">
          {mode === "choose" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode("create")}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-colors text-left group"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft shrink-0">
                  <Home className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">Skapa nytt hushåll</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Du är den första — bjud in din partner efteråt</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>

              <button
                onClick={() => setMode("join")}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-colors text-left group"
              >
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">Gå med via inbjudningskod</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Din partner har redan ett hushåll</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            </div>
          )}

          {mode === "create" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-display font-semibold text-lg text-foreground">Skapa hushåll</h2>
                <p className="text-sm text-muted-foreground mt-1">Välj ett namn som ni känner igen.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="household-name">Hushållsnamn</Label>
                <Input
                  id="household-name"
                  placeholder="T.ex. Familjen Andersson"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("choose")} className="flex-1 rounded-xl" disabled={loading}>
                  Tillbaka
                </Button>
                <Button onClick={handleCreate} disabled={!householdName.trim() || loading} className="flex-1 bg-gradient-primary hover:opacity-90 rounded-xl">
                  {loading ? "Skapar…" : "Skapa"}
                </Button>
              </div>
            </div>
          )}

          {mode === "join" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-display font-semibold text-lg text-foreground">Gå med i hushåll</h2>
                <p className="text-sm text-muted-foreground mt-1">Klistra in koden som din partner delade.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-code">Inbjudningskod</Label>
                <Input
                  id="invite-code"
                  placeholder="T.ex. AB12CD"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="rounded-xl font-mono tracking-widest uppercase"
                  maxLength={6}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("choose")} className="flex-1 rounded-xl" disabled={loading}>
                  Tillbaka
                </Button>
                <Button onClick={handleJoin} disabled={inviteCode.length < 6 || loading} className="flex-1 bg-gradient-primary hover:opacity-90 rounded-xl">
                  {loading ? "Letar…" : "Gå med"}
                </Button>
              </div>
            </div>
          )}

          {mode === "created" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-display font-semibold text-lg text-foreground">"{householdName}" är skapat!</h2>
                <p className="text-sm text-muted-foreground mt-1">Dela koden med din partner så kan de gå med.</p>
              </div>
              <div className="bg-secondary rounded-xl p-4 flex items-center justify-between gap-3">
                <span className="font-mono font-bold text-2xl tracking-[0.2em] text-foreground">{generatedCode}</span>
                <button
                  onClick={copyCode}
                  className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                  aria-label="Kopiera kod"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Koden är giltig i 7 dagar.</p>
              <Button onClick={() => navigate("/", { replace: true })} className="w-full bg-gradient-primary hover:opacity-90 rounded-xl h-11">
                Kom igång <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        <button onClick={signOut} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
          Logga ut
        </button>
      </div>
    </div>
  );
}

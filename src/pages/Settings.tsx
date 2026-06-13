import { useState, useMemo, useRef } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, UserPlus, Copy, Check, LogOut, Lock, Download, FileText, UserX, Upload, FileSpreadsheet, AlertTriangle, ArrowLeft, Sparkles, Wand2, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImportRule, ImportRuleMatch } from "@/types/budget";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  parseCsvFile,
  buildStaged,
  BANK_PRESETS,
  type ColumnMapping,
  type ParseResult,
  type StagedTx,
} from "@/lib/csv-import";
import { sek, dateLabel } from "@/lib/format";

const PERSON_COLORS = [
  "#1e3a5f", // navy
  "#ec4899", // pink
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f97316", // orange
];

export default function Settings() {
  const { state, dispatch } = useBudget();
  const [clearOpen, setClearOpen] = useState(false);
  const [clearInput, setClearInput] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Inställningar</h1>
        <p className="text-sm text-muted-foreground mt-1">Skräddarsy BudgetBuddy efter er grupp.</p>
      </div>

      {/* Group */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
        <h2 className="font-display font-semibold">Grupp</h2>
        <div className="space-y-2">
          <Label htmlFor="household-name">Gruppnamn</Label>
          <Input
            id="household-name"
            value={state.settings.householdName}
            onChange={e => dispatch({ type: "UPDATE_SETTINGS", patch: { householdName: e.target.value } })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-day">Lönedag</Label>
          <div className="flex items-center gap-3">
            <Input
              id="pay-day"
              type="number"
              min={1}
              max={28}
              value={state.settings.payDay ?? 1}
              onChange={e => {
                const v = Math.max(1, Math.min(28, parseInt(e.target.value) || 1));
                dispatch({ type: "UPDATE_SETTINGS", patch: { payDay: v } });
              }}
              className="rounded-xl w-24"
            />
            <p className="text-sm text-muted-foreground">
              {(state.settings.payDay ?? 1) <= 1
                ? "Kalendermånad (1:a – sista)"
                : `Löneperiod: ${state.settings.payDay}:e varje månad`}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sätt till 25 om lönen kommer den 25:e — då räknas "månaden" från 25:e till 24:e.
          </p>
        </div>
      </Card>

      {/* Members */}
      <MembersSection />

      {/* Theme */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
        <h2 className="font-display font-semibold">Tema</h2>
        <Select value={state.settings.theme} onValueChange={(v: "light" | "dark" | "system") => dispatch({ type: "UPDATE_SETTINGS", patch: { theme: v } })}>
          <SelectTrigger className="rounded-xl max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Ljust</SelectItem>
            <SelectItem value="dark">Mörkt</SelectItem>
            <SelectItem value="system">Följ system</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Import rules */}
      <ImportRulesEditor />

      {/* Import CSV */}
      <ImportSection />

      {/* Export data */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
        <div>
          <h2 className="font-display font-semibold">Exportera data</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Ladda ner alla transaktioner — din rätt enligt GDPR Art. 20.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              const { exportTransactionsXLSX } = await import("@/lib/export");
              exportTransactionsXLSX({ transactions: state.transactions, categories: state.categories, persons: state.persons });
            }}
          >
            <FileText className="h-4 w-4" /> Exportera XLSX
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              const { exportTransactionsPDF } = await import("@/lib/export");
              exportTransactionsPDF({ transactions: state.transactions, categories: state.categories, persons: state.persons });
            }}
          >
            <Download className="h-4 w-4" /> Exportera PDF
          </Button>
        </div>
      </Card>

      {/* Account */}
      <AccountSection />

      {/* Danger zone */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4 border-destructive/20">
        <h2 className="font-display font-semibold text-destructive">Farlig zon</h2>
        <p className="text-sm text-muted-foreground">Åtgärder som inte kan ångras och raderar data permanent.</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="destructive" className="rounded-xl" onClick={() => { setClearInput(""); setClearOpen(true); }}>
            Rensa all data
          </Button>
          <AlertDialog open={clearOpen} onOpenChange={v => { setClearOpen(v); if (!v) setClearInput(""); }}>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Rensa alla transaktioner och mål?</AlertDialogTitle>
                <AlertDialogDescription>
                  Alla transaktioner, sparmål och lån tas bort permanent. Kategorier och inställningar behålls.
                  Detta går inte att ångra.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1 space-y-1.5">
                <Label htmlFor="clear-confirm" className="text-sm">Skriv <span className="font-mono font-bold">RENSA</span> för att bekräfta</Label>
                <Input
                  id="clear-confirm"
                  value={clearInput}
                  onChange={e => setClearInput(e.target.value)}
                  placeholder="RENSA"
                  className="rounded-xl"
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  disabled={clearInput !== "RENSA"}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  onClick={() => { dispatch({ type: "CLEAR" }); toast.success("Data rensad"); setClearOpen(false); }}
                >
                  Rensa all data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}

function AccountSection() {
  const { user, signOut, householdId, refreshHousehold } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      toast.error("Kunde inte radera kontot", { description: error.message });
      setDeleting(false);
      return;
    }
    await signOut();
  };

  const leaveHousehold = async () => {
    if (!user || !householdId) return;
    setLeaving(true);
    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", user.id)
      .eq("household_id", householdId);
    setLeaving(false);
    if (error) {
      toast.error("Kunde inte lämna gruppen", { description: error.message });
      return;
    }
    toast.success("Du har lämnat gruppen");
    await refreshHousehold();
    // RequireHousehold will redirect to /onboarding once householdId becomes null
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <h2 className="font-display font-semibold">Konto</h2>
      {user?.email && (
        <div className="text-sm text-muted-foreground">
          Inloggad som <span className="text-foreground font-medium">{user.email}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={signOut} className="rounded-xl">
          <LogOut className="h-4 w-4" /> Logga ut
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="rounded-xl text-destructive hover:text-destructive">
              Lämna gruppen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Lämna gruppen?</AlertDialogTitle>
              <AlertDialogDescription>
                Du tas bort som medlem och kommer inte längre se gruppens transaktioner, kategorier eller sparmål.
                Du kan gå med igen senare via en ny inbjudningskod.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={leaving}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                disabled={leaving}
                onClick={leaveHousehold}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {leaving ? "Lämnar…" : "Lämna gruppen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Radera konto */}
        <Button
          variant="destructive"
          className="rounded-xl"
          disabled={deleting}
          onClick={() => { setDeleteEmailInput(""); setDeleteOpen(true); }}
        >
          <UserX className="h-4 w-4" /> {deleting ? "Raderar…" : "Radera mitt konto"}
        </Button>
        <AlertDialog open={deleteOpen} onOpenChange={v => { setDeleteOpen(v); if (!v) setDeleteEmailInput(""); }}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Radera konto permanent?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">Du raderas från alla hushåll och all din persondata tas bort omedelbart.</span>
                <span className="block">Dina transaktioner behålls anonymt — kopplade till hushållet, inte till dig.</span>
                <span className="block font-medium text-destructive">Detta går inte att ångra.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 space-y-1.5">
              <Label htmlFor="delete-email-confirm" className="text-sm">
                Bekräfta genom att skriva din e-postadress
              </Label>
              <Input
                id="delete-email-confirm"
                type="email"
                value={deleteEmailInput}
                onChange={e => setDeleteEmailInput(e.target.value)}
                placeholder={user?.email ?? "din@email.se"}
                className="rounded-xl"
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting || deleteEmailInput !== user?.email}
                onClick={deleteAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? "Raderar…" : "Ja, radera mitt konto"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}

function MembersSection() {
  const { state, dispatch } = useBudget();
  const { user, householdId } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    if (!householdId || !user) return;
    setInviteLoading(true);

    // Fynd 11: Deaktivera gamla oanvända koder – max 1 aktiv kod per hushåll
    await supabase
      .from("household_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("household_id", householdId)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString());

    // Fynd 3: 8-teckens kod med kryptografisk slump (36^8 ≈ 2,8 biljoner kombinationer)
    const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(bytes, b => CHARS[b % 36]).join("");

    const { error } = await supabase.from("household_invites").insert({
      household_id: householdId,
      invite_code: code,
      created_by: user.id,
    });
    setInviteLoading(false);
    if (error) {
      toast.error("Kunde inte skapa kod");
      return;
    }
    setInviteCode(code);
    setCopied(false);
    setInviteOpen(true);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-display font-semibold">Medlemmar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.persons.length} {state.persons.length === 1 ? "medlem" : "medlemmar"} i gruppen
          </p>
        </div>
        <Button
          size="sm"
          onClick={generateInvite}
          disabled={inviteLoading || !householdId}
          className="rounded-xl"
        >
          <UserPlus className="h-4 w-4" /> {inviteLoading ? "Skapar…" : "Bjud in"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {state.persons.map(p => {
          // Fynd 12: endast den inloggade personen kan redigera sin egen profil
          const isMe = p.id === user?.id;
          return (
          <div key={p.id} className="p-4 rounded-xl bg-muted/40 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ background: p.color }}
                aria-hidden="true"
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Label htmlFor={`person-name-${p.id}`} className="text-xs">Namn</Label>
                  {!isMe && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Skrivskyddad" />}
                </div>
                <Input
                  id={`person-name-${p.id}`}
                  value={p.name}
                  onChange={e => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { name: e.target.value } })}
                  className="rounded-xl"
                  disabled={!isMe}
                  readOnly={!isMe}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Färg</Label>
              <div role="radiogroup" aria-label={`Färg för ${p.name}`} className="flex flex-wrap gap-1.5">
                {PERSON_COLORS.map(c => {
                  const selected = p.color.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Välj färg ${c}`}
                      onClick={() => isMe && dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { color: c } })}
                      disabled={!isMe}
                      className={cn(
                        "h-7 w-7 rounded-full transition ring-offset-2 ring-offset-muted/40",
                        selected ? "ring-2 ring-foreground scale-110" : "hover:scale-105",
                        !isMe && "opacity-50 cursor-not-allowed",
                      )}
                      style={{ background: c }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`person-income-${p.id}`} className="text-xs">Månadsinkomst (SEK)</Label>
              <NumericInput
                id={`person-income-${p.id}`}
                value={p.income || 0}
                onChange={v => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { income: v } })}
                placeholder="0"
                className="rounded-xl"
                disabled={!isMe}
                readOnly={!isMe}
              />
            </div>
          </div>
          );
        })}
      </div>

      {state.persons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Inga medlemmar än.</p>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Bjud in medlem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dela koden med personen du vill bjuda in. Den är giltig i 7 dagar.
            </p>
            <div className="bg-secondary rounded-xl p-4 flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl tracking-[0.2em] text-foreground">{inviteCode}</span>
              <button
                onClick={copyCode}
                className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                aria-label="Kopiera kod"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteOpen(false)} className="bg-gradient-primary rounded-xl w-full">Klar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ImportRulesEditor() {
  const { state, dispatch } = useBudget();
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<ImportRuleMatch>("contains");
  const [categoryId, setCategoryId] = useState<string>(state.categories[0]?.id ?? "");
  const [payerId, setPayerId] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(false);

  const add = () => {
    if (!pattern.trim()) { toast.error("Ange ett mönster"); return; }
    const rule: ImportRule = {
      id: crypto.randomUUID(),
      pattern: pattern.trim(),
      matchType,
      categoryId: categoryId || null,
      payerId: payerId || null,
      priority: (state.importRules[0]?.priority ?? 0) + 1,
      isPrivate,
    };
    dispatch({ type: "UPSERT_RULE", rule });
    setPattern("");
    setIsPrivate(false);
    toast.success("Regel skapad");
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div>
        <h2 className="font-display font-semibold">Importregler</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Auto-kategorisera transaktioner vid CSV-import baserat på beskrivningen.</p>
      </div>

      <div className="space-y-2">
        {state.importRules.length === 0 && (
          <div className="text-sm text-muted-foreground p-3 rounded-xl bg-muted/30">
            Inga regler än. Lägg till din första nedan.
          </div>
        )}
        {state.importRules.map(r => {
          const c = state.categories.find(c => c.id === r.categoryId);
          const p = state.persons.find(p => p.id === r.payerId);
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {r.isPrivate && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Privat" />}
                  <span className="truncate">"{r.pattern}"</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.matchType} → {c ? `${c.icon} ${c.name}` : "ingen kategori"}{p ? ` · ${p.name}` : ""}{r.isPrivate ? " · privat" : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => dispatch({ type: "DELETE_RULE", id: r.id })} aria-label="Ta bort regel">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <Input placeholder="Mönster, t.ex. WILLYS" value={pattern} onChange={e => setPattern(e.target.value)} className="rounded-xl md:col-span-2" />
        <Select value={matchType} onValueChange={v => setMatchType(v as ImportRuleMatch)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Innehåller</SelectItem>
            <SelectItem value="starts_with">Börjar med</SelectItem>
            <SelectItem value="exact">Exakt</SelectItem>
            <SelectItem value="regex">Regex</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            {state.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={payerId || "none"} onValueChange={v => setPayerId(v === "none" ? "" : v)}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Person" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen</SelectItem>
            {state.persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Switch id="rule-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
          <Label htmlFor="rule-private" className="text-sm flex items-center gap-1.5 cursor-pointer">
            <Lock className="h-3.5 w-3.5" /> Markera matchningar som privata
          </Label>
        </div>
        <Button onClick={add} className="bg-gradient-primary rounded-xl"><Plus className="h-4 w-4" /> Lägg till regel</Button>
      </div>
    </Card>
  );
}

type ImportStep = "upload" | "map" | "review";

function ImportSection() {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", amount: "", description: "" });
  const [staged, setStaged] = useState<StagedTx[]>([]);
  const [defaultPayer, setDefaultPayer] = useState(state.persons[0]?.id ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.csv$/i)) { toast.error("Endast .csv-filer stöds just nu"); return; }
    try {
      const result = await parseCsvFile(file);
      if (!result.headers.length || !result.rows.length) { toast.error("Filen verkar tom eller felformaterad"); return; }
      setFileName(file.name);
      setParsed(result);
      setMapping(result.suggestedMapping);
      setStep("map");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte läsa filen");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const goReview = () => {
    if (!parsed) return;
    if (!mapping.date || !mapping.amount || !mapping.description) { toast.error("Mappa alla tre kolumner"); return; }
    const built = buildStaged(parsed.rows, mapping, state.categories, state.transactions, state.importRules);
    if (!built.length) { toast.error("Hittade inga giltiga rader att importera"); return; }
    const matched = built.filter(b => b.matchedRuleId).length;
    setStaged(built);
    setStep("review");
    if (matched > 0) toast.success(`${matched} rader kategoriserade automatiskt via regler`);
  };

  const ruleMatchedCount = useMemo(() => staged.filter(s => s.matchedRuleId).length, [staged]);

  const saveAsRule = (s: StagedTx) => {
    const word = (s.description.match(/[A-Za-zÅÄÖåäö]{4,}/g) ?? [])
      .sort((a, b) => b.length - a.length)[0] ?? s.description.slice(0, 12);
    if (!s.categoryId) { toast.error("Sätt en kategori först"); return; }
    dispatch({ type: "UPSERT_RULE", rule: { id: crypto.randomUUID(), pattern: word, matchType: "contains", categoryId: s.categoryId, payerId: defaultPayer || null, priority: 0 } });
    setStaged(prev => prev.map(p => {
      if (p.rowIndex === s.rowIndex || p.matchedRuleId) return p;
      if (p.description.toLowerCase().includes(word.toLowerCase())) return { ...p, categoryId: s.categoryId, matchedRuleId: "pending" };
      return p;
    }));
    toast.success(`Regel sparad: "${word}" → ${state.categories.find(c => c.id === s.categoryId)?.name ?? ""}`);
  };

  const selectedCount = useMemo(() => staged.filter(s => s.selected).length, [staged]);
  const dupCount = useMemo(() => staged.filter(s => s.isDuplicate).length, [staged]);

  const updateRow = (rowIndex: number, patch: Partial<StagedTx>) =>
    setStaged(prev => prev.map(s => s.rowIndex === rowIndex ? { ...s, ...patch } : s));

  const toggleAll = (checked: boolean) =>
    setStaged(prev => prev.map(s => ({ ...s, selected: checked && !s.isDuplicate ? true : checked })));

  const doImport = async () => {
    const toImport = staged.filter(s => s.selected);
    if (!toImport.length) { toast.error("Markera minst en transaktion"); return; }
    if (!defaultPayer) { toast.error("Välj betalare"); return; }
    setImporting(true);
    for (const s of toImport) {
      const effectivePayer = s.isPrivate && user?.id ? user.id : (s.payerId || defaultPayer);
      dispatch({
        type: "ADD_TX",
        tx: {
          date: s.date,
          amount: s.amount,
          type: s.type,
          categoryId: s.categoryId,
          payerId: effectivePayer,
          description: s.description,
          isPrivate: s.isPrivate,
          ownerId: s.isPrivate ? user?.id : undefined,
        },
      });
    }
    toast.success(`${toImport.length} transaktioner importerade`);
    setImporting(false);
    setStep("upload");
    setStaged([]);
    setParsed(null);
    setFileName("");
  };

  const steps: ImportStep[] = ["upload", "map", "review"];

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div>
        <h2 className="font-display font-semibold">Importera transaktioner</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Ladda upp en CSV från din bank — vi mappar kolumnerna och föreslår kategorier automatiskt.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium",
              step === s ? "bg-primary text-primary-foreground"
              : steps.indexOf(step) > i ? "bg-emerald-500 text-white"
              : "bg-muted text-muted-foreground"
            )}>
              {steps.indexOf(step) > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn(step === s ? "font-medium" : "text-muted-foreground")}>
              {s === "upload" ? "Ladda upp" : s === "map" ? "Mappa kolumner" : "Granska & importera"}
            </span>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn("border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <div className="font-medium">Släpp CSV-fil här eller klicka för att välja</div>
            <div className="text-sm text-muted-foreground mt-1">Stödda banker: Swedbank, SEB, Handelsbanken, Nordea, ICA Banken m.fl.</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BANK_PRESETS.map(b => (
              <div key={b.id} className="p-3 rounded-xl border border-border text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />{b.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Mapping */}
      {step === "map" && parsed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{fileName}</div>
              <div className="text-sm text-muted-foreground">
                {parsed.rows.length} rader · {parsed.headers.length} kolumner
                {parsed.detectedPreset && (
                  <Badge variant="secondary" className="ml-2 gap-1"><Sparkles className="h-3 w-3" /> Identifierad: {parsed.detectedPreset.name}</Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setStep("upload")}><ArrowLeft className="h-4 w-4" /> Byt fil</Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {(["date", "amount", "description"] as const).map(field => (
              <div key={field}>
                <label className="text-sm font-medium mb-1.5 block">
                  {field === "date" ? "Datum" : field === "amount" ? "Belopp" : "Beskrivning"}
                </label>
                <Select value={mapping[field] || undefined} onValueChange={v => setMapping({ ...mapping, [field]: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj kolumn" /></SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Förhandsgranskning</div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>{parsed.headers.map(h => <th key={h} className={cn("text-left p-2 font-medium", Object.values(mapping).includes(h) && "text-primary")}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {parsed.headers.map(h => <td key={h} className="p-2 text-muted-foreground">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={goReview} className="bg-gradient-primary">Fortsätt till granskning</Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-primary">{selectedCount} valda</Badge>
              {ruleMatchedCount > 0 && <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3 text-primary" /> {ruleMatchedCount} via regler</Badge>}
              {dupCount > 0 && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> {dupCount} möjliga dubbletter</Badge>}
              <span className="text-sm text-muted-foreground">av {staged.length} totalt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Standard-betalare:</span>
              <Select value={defaultPayer} onValueChange={setDefaultPayer}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="p-2 w-10"><Checkbox checked={selectedCount === staged.length} onCheckedChange={v => toggleAll(!!v)} /></th>
                  <th className="text-left p-2 font-medium">Datum</th>
                  <th className="text-left p-2 font-medium">Beskrivning</th>
                  <th className="text-left p-2 font-medium">Kategori</th>
                  <th className="text-right p-2 font-medium">Belopp</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {staged.map(s => (
                  <tr key={s.rowIndex} className={cn("border-t border-border", s.isDuplicate && "bg-amber-50/50 dark:bg-amber-950/20")}>
                    <td className="p-2"><Checkbox checked={s.selected} onCheckedChange={v => updateRow(s.rowIndex, { selected: !!v })} /></td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{dateLabel(s.date)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[260px]">{s.description}</span>
                        {s.matchedRuleId && <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary gap-0.5"><Zap className="h-2.5 w-2.5" /> regel</Badge>}
                        {s.isDuplicate && <Badge variant="outline" className="text-[10px] h-5 border-amber-500 text-amber-700 dark:text-amber-400">dubblett</Badge>}
                      </div>
                    </td>
                    <td className="p-2">
                      <Select value={s.categoryId} onValueChange={v => updateRow(s.rowIndex, { categoryId: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {state.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={cn("p-2 text-right font-medium whitespace-nowrap tabular-nums", s.type === "income" ? "text-emerald-600" : "text-foreground")}>
                      {s.type === "income" ? "+" : "−"}{sek(s.amount)}
                    </td>
                    <td className="p-2 text-right">
                      {!s.matchedRuleId && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Spara som regel" onClick={() => saveAsRule(s)}>
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("map")}><ArrowLeft className="h-4 w-4" /> Tillbaka</Button>
            <Button onClick={doImport} disabled={importing || selectedCount === 0} className="bg-gradient-primary">
              Importera {selectedCount} transaktioner
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

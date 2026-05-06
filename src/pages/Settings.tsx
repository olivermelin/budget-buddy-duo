import { useState } from "react";
import { useBudget } from "@/store/budget-store";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, UserPlus, Copy, Check, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecurringTransaction } from "@/types/budget";

const ICONS = ["🛒", "🏠", "🚗", "🎬", "🛍️", "📱", "✈️", "✨", "🍽️", "💪", "📚", "🐾", "💊", "🎁"];

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

      {/* Categories */}
      <CategoriesEditor />

      {/* Recurring transactions */}
      <RecurringEditor />

      {/* Account */}
      <AccountSection />

      {/* Danger zone */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4 border-destructive/20">
        <h2 className="font-display font-semibold text-destructive">Återställ data</h2>
        <p className="text-sm text-muted-foreground">All data sparas lokalt i din webbläsare. Du kan när som helst återställa.</p>
        <div className="flex gap-2 flex-wrap">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-xl">Återställ till mockdata</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Återställ all data?</AlertDialogTitle>
                <AlertDialogDescription>All din nuvarande data ersätts med exempeldata. Detta går inte att ångra.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={() => { dispatch({ type: "RESET" }); toast.success("Mockdata återställd"); }}>Återställ</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="rounded-xl">Rensa all data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Rensa alla transaktioner och mål?</AlertDialogTitle>
                <AlertDialogDescription>Du börjar med ett tomt konto. Detta går inte att ångra.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={() => { dispatch({ type: "CLEAR" }); toast.success("Data rensad"); }}>Rensa</AlertDialogAction>
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
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(36).toUpperCase())
      .join("")
      .slice(0, 6);
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
        {state.persons.map(p => (
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
                <Label htmlFor={`person-name-${p.id}`} className="text-xs">Namn</Label>
                <Input
                  id={`person-name-${p.id}`}
                  value={p.name}
                  onChange={e => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { name: e.target.value } })}
                  className="rounded-xl mt-1"
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
                      onClick={() => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { color: c } })}
                      className={cn(
                        "h-7 w-7 rounded-full transition ring-offset-2 ring-offset-muted/40",
                        selected ? "ring-2 ring-foreground scale-110" : "hover:scale-105",
                      )}
                      style={{ background: c }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`person-income-${p.id}`} className="text-xs">Månadsinkomst (SEK)</Label>
              <Input
                id={`person-income-${p.id}`}
                type="number"
                value={p.income}
                onChange={e => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { income: parseFloat(e.target.value) || 0 } })}
                className="rounded-xl"
              />
            </div>
          </div>
        ))}
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

function RecurringEditor() {
  const { state, dispatch } = useBudget();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [payerId, setPayerId] = useState(state.persons[0]?.id ?? "");
  const [day, setDay] = useState("25");
  const [isActive, setIsActive] = useState(true);

  const openNew = () => {
    setEditing(null);
    setType("expense");
    setDescription("");
    setAmount("");
    setCategoryId(state.categories[0]?.id ?? "");
    setPayerId(state.persons[0]?.id ?? user?.id ?? "");
    setDay("25");
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (rt: RecurringTransaction) => {
    setEditing(rt);
    setType(rt.type);
    setDescription(rt.description);
    setAmount(String(rt.amount));
    setCategoryId(rt.categoryId);
    setPayerId(rt.payerId);
    setDay(String(rt.dayOfMonth));
    setIsActive(rt.isActive);
    setOpen(true);
  };

  const save = () => {
    const num = parseFloat(amount.replace(",", "."));
    if (!num || num <= 0) { toast.error("Ange ett belopp"); return; }
    if (!description.trim()) { toast.error("Lägg till beskrivning"); return; }
    const dayNum = parseInt(day, 10);
    if (!dayNum || dayNum < 1 || dayNum > 31) { toast.error("Dag måste vara 1–31"); return; }

    const rt: RecurringTransaction = {
      id: editing?.id ?? crypto.randomUUID(),
      description: description.trim(),
      amount: num,
      type,
      categoryId,
      payerId,
      dayOfMonth: dayNum,
      isActive,
      lastGeneratedMonth: editing?.lastGeneratedMonth ?? null,
    };
    dispatch({ type: "UPSERT_RECURRING", rt });
    toast.success(editing ? "Uppdaterad" : "Återkommande transaktion skapad");
    setOpen(false);
  };

  const remove = (id: string) => {
    dispatch({ type: "DELETE_RECURRING", id });
    toast.success("Borttagen");
  };

  const toggleActive = (rt: RecurringTransaction) => {
    dispatch({ type: "UPSERT_RECURRING", rt: { ...rt, isActive: !rt.isActive } });
  };

  const typeLabel = (rt: RecurringTransaction) =>
    rt.type === "income" ? "Inkomst" : "Utgift";

  const catName = (id: string) =>
    state.categories.find(c => c.id === id)?.name ?? "–";

  const personName = (id: string) =>
    state.persons.find(p => p.id === id)?.name ?? "–";

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold">Återkommande transaktioner</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Läggs in automatiskt varje månad</p>
        </div>
        <Button size="sm" onClick={openNew} className="rounded-xl"><Plus className="h-4 w-4" /> Ny</Button>
      </div>

      {state.recurringTransactions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Inga återkommande transaktioner än.</p>
      )}

      <div className="space-y-2">
        {state.recurringTransactions.map(rt => (
          <div key={rt.id} className={cn("flex items-center gap-3 p-3 rounded-xl bg-muted/30", !rt.isActive && "opacity-50")}>
            <div className="text-lg w-8 text-center">{rt.type === "income" ? "💰" : "📅"}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{rt.description}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", rt.type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {typeLabel(rt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rt.amount.toLocaleString("sv-SE")} kr · dag {rt.dayOfMonth} · {catName(rt.categoryId)} · {personName(rt.payerId)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Switch
                checked={rt.isActive}
                onCheckedChange={() => toggleActive(rt)}
                aria-label={rt.isActive ? "Inaktivera" : "Aktivera"}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rt)} aria-label="Redigera">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(rt.id)} aria-label="Ta bort">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Redigera" : "Ny återkommande transaktion"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div role="group" aria-label="Typ" className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button onClick={() => setType("expense")} aria-pressed={type === "expense"}
                className={cn("py-2 rounded-lg text-sm font-medium transition", type === "expense" ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Utgift
              </button>
              <button onClick={() => setType("income")} aria-pressed={type === "income"}
                className={cn("py-2 rounded-lg text-sm font-medium transition", type === "income" ? "bg-card shadow-soft" : "text-muted-foreground")}>
                Inkomst
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rt-desc">Beskrivning</Label>
              <Input id="rt-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="T.ex. Lön, Hyra, Spotify" className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rt-amount">Belopp (SEK)</Label>
                <Input id="rt-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-day">Dag i månaden</Label>
                <Input id="rt-day" type="number" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rt-cat">Kategori</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="rt-cat" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.categories.map(c => (
                      <SelectItem key={c.id} value={c.id}><span className="mr-1">{c.icon}</span>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-payer">{type === "expense" ? "Betalare" : "Mottagare"}</Label>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger id="rt-payer" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.persons.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="rt-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="rt-active">Aktiv</Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Avbryt</Button>
            <Button onClick={save} className="bg-gradient-primary rounded-xl">{editing ? "Uppdatera" : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CategoriesEditor() {
  const { state, dispatch } = useBudget();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [icon, setIcon] = useState("✨");

  const add = () => {
    if (!name.trim()) return;
    dispatch({ type: "UPSERT_CATEGORY", cat: {
      id: Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      icon,
      color: `${Math.floor(Math.random() * 360)} 70% 50%`,
      budget: parseFloat(budget) || 0,
    }});
    setName(""); setBudget(""); setIcon("✨"); setAdding(false);
    toast.success("Kategori tillagd");
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Kategorier & budget</h2>
        <Button size="sm" onClick={() => setAdding(true)} className="rounded-xl"><Plus className="h-4 w-4" /> Ny</Button>
      </div>
      <div className="space-y-2">
        {state.categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <div className="text-xl w-8 text-center">{c.icon}</div>
            <Input
              value={c.name}
              onChange={e => dispatch({ type: "UPSERT_CATEGORY", cat: { ...c, name: e.target.value } })}
              className="rounded-lg max-w-[180px] h-9"
            />
            <Input
              type="number"
              value={c.budget}
              onChange={e => dispatch({ type: "UPSERT_CATEGORY", cat: { ...c, budget: parseFloat(e.target.value) || 0 } })}
              className="rounded-lg max-w-[120px] h-9"
            />
            <span className="text-xs text-muted-foreground hidden md:inline">SEK/mån</span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground hidden md:inline">Fast</span>
              <Switch checked={!!c.isFixed} onCheckedChange={v => dispatch({ type: "UPSERT_CATEGORY", cat: { ...c, isFixed: v } })} />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => dispatch({ type: "DELETE_CATEGORY", id: c.id })} aria-label={`Ta bort kategori ${c.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="p-4 rounded-xl border border-dashed space-y-3">
          <div className="flex flex-wrap gap-1">
            {ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)} className={`h-9 w-9 rounded-lg text-lg ${icon === i ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Namn" value={name} onChange={e => setName(e.target.value)} className="rounded-xl" />
            <Input placeholder="Budget SEK" value={budget} onChange={e => setBudget(e.target.value)} type="number" className="rounded-xl" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button onClick={add} className="bg-gradient-primary rounded-xl">Lägg till</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

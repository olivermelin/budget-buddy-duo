import { useState } from "react";
import { useBudget } from "@/store/budget-store";
import { sek } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ICONS = ["🛒", "🏠", "🚗", "🎬", "🛍️", "📱", "✈️", "✨", "🍽️", "💪", "📚", "🐾", "💊", "🎁"];

export default function Settings() {
  const { state, dispatch } = useBudget();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Inställningar</h1>
        <p className="text-sm text-muted-foreground mt-1">Skräddarsy BudgetBuddy efter ert hushåll.</p>
      </div>

      {/* Household */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
        <h2 className="font-display font-semibold">Hushåll</h2>
        <div className="space-y-2">
          <Label>Hushållsnamn</Label>
          <Input
            value={state.settings.householdName}
            onChange={e => dispatch({ type: "UPDATE_SETTINGS", patch: { householdName: e.target.value } })}
            className="rounded-xl"
          />
        </div>
      </Card>

      {/* Persons */}
      <Card className="p-6 rounded-2xl shadow-soft border-0 space-y-4">
        <h2 className="font-display font-semibold">Personer</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {state.persons.map(p => (
            <div key={p.id} className="p-4 rounded-xl bg-muted/40 space-y-3">
              <div className="space-y-2"><Label>Namn</Label>
                <Input value={p.name} onChange={e => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { name: e.target.value } })} className="rounded-xl" />
              </div>
              <div className="space-y-2"><Label>Månadsinkomst (SEK)</Label>
                <Input type="number" value={p.income} onChange={e => dispatch({ type: "UPDATE_PERSON", id: p.id, patch: { income: parseFloat(e.target.value) || 0 } })} className="rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </Card>

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
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => dispatch({ type: "DELETE_CATEGORY", id: c.id })}>
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

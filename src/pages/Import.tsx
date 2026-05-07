import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, ArrowLeft, Sparkles, Wand2, Zap } from "lucide-react";
import { useBudget } from "@/store/budget-store";
import {
  parseCsvFile,
  buildStaged,
  BANK_PRESETS,
  type ColumnMapping,
  type ParseResult,
  type StagedTx,
} from "@/lib/csv-import";
import { sek, dateLabel } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "review";

export default function Import() {
  const { state, dispatch } = useBudget();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", amount: "", description: "" });
  const [staged, setStaged] = useState<StagedTx[]>([]);
  const [defaultPayer, setDefaultPayer] = useState(state.persons[0]?.id ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.csv$/i)) {
      toast.error("Endast .csv-filer stöds just nu");
      return;
    }
    try {
      const result = await parseCsvFile(file);
      if (!result.headers.length || !result.rows.length) {
        toast.error("Filen verkar tom eller felformaterad");
        return;
      }
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
    if (!mapping.date || !mapping.amount || !mapping.description) {
      toast.error("Mappa alla tre kolumner");
      return;
    }
    const built = buildStaged(parsed.rows, mapping, state.categories, state.transactions, state.importRules);
    if (!built.length) {
      toast.error("Hittade inga giltiga rader att importera");
      return;
    }
    const matched = built.filter(b => b.matchedRuleId).length;
    setStaged(built);
    setStep("review");
    if (matched > 0) toast.success(`${matched} rader kategoriserade automatiskt via regler`);
  };

  const ruleMatchedCount = useMemo(() => staged.filter(s => s.matchedRuleId).length, [staged]);

  const saveAsRule = (s: StagedTx) => {
    // Use a sensible pattern: longest alphabetic word in description, or first 12 chars
    const word = (s.description.match(/[A-Za-zÅÄÖåäö]{4,}/g) ?? [])
      .sort((a, b) => b.length - a.length)[0] ?? s.description.slice(0, 12);
    if (!s.categoryId) { toast.error("Sätt en kategori först"); return; }
    dispatch({
      type: "UPSERT_RULE",
      rule: {
        id: crypto.randomUUID(),
        pattern: word,
        matchType: "contains",
        categoryId: s.categoryId,
        payerId: defaultPayer || null,
        priority: 0,
      },
    });
    // Re-apply rules to remaining rows
    setStaged(prev => prev.map(p => {
      if (p.rowIndex === s.rowIndex || p.matchedRuleId) return p;
      const desc = p.description.toLowerCase();
      if (desc.includes(word.toLowerCase())) {
        return { ...p, categoryId: s.categoryId, matchedRuleId: "pending" };
      }
      return p;
    }));
    toast.success(`Regel sparad: "${word}" → ${state.categories.find(c => c.id === s.categoryId)?.name ?? ""}`);
  };

  const selectedCount = useMemo(() => staged.filter((s) => s.selected).length, [staged]);
  const dupCount = useMemo(() => staged.filter((s) => s.isDuplicate).length, [staged]);

  const updateRow = (rowIndex: number, patch: Partial<StagedTx>) => {
    setStaged((prev) => prev.map((s) => (s.rowIndex === rowIndex ? { ...s, ...patch } : s)));
  };

  const toggleAll = (checked: boolean) => {
    setStaged((prev) => prev.map((s) => ({ ...s, selected: checked && !s.isDuplicate ? true : checked })));
  };

  const doImport = async () => {
    const toImport = staged.filter((s) => s.selected);
    if (!toImport.length) { toast.error("Markera minst en transaktion"); return; }
    if (!defaultPayer) { toast.error("Välj betalare"); return; }
    setImporting(true);
    for (const s of toImport) {
      dispatch({
        type: "ADD_TX",
        tx: {
          date: s.date,
          amount: s.amount,
          type: s.type,
          categoryId: s.categoryId,
          payerId: s.payerId || defaultPayer,
          description: s.description,
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold">Importera transaktioner</h1>
        <p className="text-muted-foreground mt-1">
          Ladda upp en CSV från din bank — vi mappar kolumnerna och föreslår kategorier automatiskt.
        </p>
      </header>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "map", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium",
              step === s ? "bg-primary text-primary-foreground" :
                ["upload", "map", "review"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            )}>
              {["upload", "map", "review"].indexOf(step) > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
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
        <Card className="p-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
            )}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div className="font-medium text-lg">Släpp CSV-fil här eller klicka för att välja</div>
            <div className="text-sm text-muted-foreground mt-2">
              Stödda banker: Swedbank, SEB, Handelsbanken, Nordea, ICA Banken m.fl.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            {BANK_PRESETS.map((b) => (
              <div key={b.id} className="p-3 rounded-xl border border-border text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                {b.name}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* STEP 2: Mapping */}
      {step === "map" && parsed && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{fileName}</div>
              <div className="text-sm text-muted-foreground">
                {parsed.rows.length} rader · {parsed.headers.length} kolumner
                {parsed.detectedPreset && (
                  <Badge variant="secondary" className="ml-2 gap-1">
                    <Sparkles className="h-3 w-3" /> Identifierad: {parsed.detectedPreset.name}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setStep("upload")}>
              <ArrowLeft className="h-4 w-4" /> Byt fil
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {(["date", "amount", "description"] as const).map((field) => (
              <div key={field}>
                <label className="text-sm font-medium mb-1.5 block">
                  {field === "date" ? "Datum" : field === "amount" ? "Belopp" : "Beskrivning"}
                </label>
                <Select value={mapping[field] || undefined} onValueChange={(v) => setMapping({ ...mapping, [field]: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj kolumn" /></SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Preview first 5 rows */}
          <div>
            <div className="text-sm font-medium mb-2">Förhandsgranskning</div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h} className={cn(
                        "text-left p-2 font-medium",
                        Object.values(mapping).includes(h) && "text-primary",
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {parsed.headers.map((h) => (
                        <td key={h} className="p-2 text-muted-foreground">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={goReview} className="bg-gradient-primary">Fortsätt till granskning</Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Review */}
      {step === "review" && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-primary">{selectedCount} valda</Badge>
              {dupCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" /> {dupCount} möjliga dubbletter
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">av {staged.length} totalt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Standard-betalare:</span>
              <Select value={defaultPayer} onValueChange={setDefaultPayer}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.persons.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="p-2 w-10">
                    <Checkbox
                      checked={selectedCount === staged.length}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                  </th>
                  <th className="text-left p-2 font-medium">Datum</th>
                  <th className="text-left p-2 font-medium">Beskrivning</th>
                  <th className="text-left p-2 font-medium">Kategori</th>
                  <th className="text-right p-2 font-medium">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {staged.map((s) => (
                  <tr key={s.rowIndex} className={cn(
                    "border-t border-border",
                    s.isDuplicate && "bg-amber-50/50 dark:bg-amber-950/20",
                  )}>
                    <td className="p-2">
                      <Checkbox
                        checked={s.selected}
                        onCheckedChange={(v) => updateRow(s.rowIndex, { selected: !!v })}
                      />
                    </td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{dateLabel(s.date)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[260px]">{s.description}</span>
                        {s.isDuplicate && (
                          <Badge variant="outline" className="text-[10px] h-5 border-amber-500 text-amber-700 dark:text-amber-400">
                            dubblett
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <Select value={s.categoryId} onValueChange={(v) => updateRow(s.rowIndex, { categoryId: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {state.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={cn(
                      "p-2 text-right font-medium whitespace-nowrap tabular-nums",
                      s.type === "income" ? "text-emerald-600" : "text-foreground",
                    )}>
                      {s.type === "income" ? "+" : "−"}{sek(s.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("map")}>
              <ArrowLeft className="h-4 w-4" /> Tillbaka
            </Button>
            <Button onClick={doImport} disabled={importing || selectedCount === 0} className="bg-gradient-primary">
              Importera {selectedCount} transaktioner
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

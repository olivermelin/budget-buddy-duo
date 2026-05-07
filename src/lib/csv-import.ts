import Papa from "papaparse";
import { Category, Transaction, ImportRule } from "@/types/budget";

export type BankPreset = {
  id: string;
  name: string;
  delimiter?: string;
  // Possible header names, lowercased, used for auto-mapping
  date: string[];
  amount: string[];
  description: string[];
  // If amount is split into debit/credit columns
  debit?: string[];
  credit?: string[];
};

export const BANK_PRESETS: BankPreset[] = [
  {
    id: "swedbank",
    name: "Swedbank",
    date: ["bokföringsdag", "transaktionsdag", "datum"],
    amount: ["belopp"],
    description: ["beskrivning", "text", "meddelande"],
  },
  {
    id: "seb",
    name: "SEB",
    date: ["bokföringsdatum", "datum"],
    amount: ["belopp"],
    description: ["text", "beskrivning"],
  },
  {
    id: "handelsbanken",
    name: "Handelsbanken",
    date: ["bokföringsdatum", "transaktionsdatum", "datum"],
    amount: ["belopp"],
    description: ["text", "beskrivning"],
  },
  {
    id: "nordea",
    name: "Nordea",
    date: ["bokföringsdag", "datum"],
    amount: ["belopp"],
    description: ["rubrik", "meddelande", "text"],
  },
  {
    id: "ica",
    name: "ICA Banken",
    date: ["datum"],
    amount: ["belopp"],
    description: ["text", "beskrivning"],
  },
];

export type ColumnMapping = {
  date: string;
  amount: string;
  description: string;
};

export type ParsedRow = Record<string, string>;

export type StagedTx = {
  rowIndex: number;
  date: string;          // ISO YYYY-MM-DD
  amount: number;        // always positive
  type: "expense" | "income";
  description: string;
  categoryId: string;    // suggested
  isDuplicate: boolean;
  selected: boolean;
};

export type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
  detectedPreset: BankPreset | null;
  suggestedMapping: ColumnMapping;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function pickHeader(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => norm(h));
  for (const c of candidates) {
    const i = lower.indexOf(norm(c));
    if (i >= 0) return headers[i];
  }
  // fuzzy: contains
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(norm(c)));
    if (i >= 0) return headers[i];
  }
  return "";
}

export function detectPreset(headers: string[]): { preset: BankPreset | null; mapping: ColumnMapping } {
  let best: { preset: BankPreset; score: number; mapping: ColumnMapping } | null = null;
  for (const preset of BANK_PRESETS) {
    const date = pickHeader(headers, preset.date);
    const amount = pickHeader(headers, preset.amount);
    const description = pickHeader(headers, preset.description);
    const score = (date ? 1 : 0) + (amount ? 1 : 0) + (description ? 1 : 0);
    if (score >= 2 && (!best || score > best.score)) {
      best = { preset, score, mapping: { date, amount, description } };
    }
  }
  if (best) return { preset: best.preset, mapping: best.mapping };
  // Fallback generic detection
  return {
    preset: null,
    mapping: {
      date: pickHeader(headers, ["datum", "date", "bokföringsdatum", "bokföringsdag", "transaktionsdatum"]),
      amount: pickHeader(headers, ["belopp", "amount", "summa"]),
      description: pickHeader(headers, ["beskrivning", "text", "rubrik", "description", "meddelande", "mottagare"]),
    },
  };
}

export async function parseCsvFile(file: File): Promise<ParseResult> {
  // Read raw text first so we can detect delimiter & encoding manually
  const buf = await file.arrayBuffer();
  // Try UTF-8 first, then ISO-8859-1 if many replacement chars
  let text = new TextDecoder("utf-8").decode(buf);
  if ((text.match(/\uFFFD/g) ?? []).length > 5) {
    text = new TextDecoder("iso-8859-1").decode(buf);
  }
  // Detect delimiter (semicolon is common in SE)
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const delim = firstLine.includes(";") ? ";" : ",";

  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    delimiter: delim,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows = result.data.filter((r) => Object.values(r).some((v) => v && String(v).trim()));
  const { preset, mapping } = detectPreset(headers);
  return { headers, rows, detectedPreset: preset, suggestedMapping: mapping };
}

// ─── Date parsing ────────────────────────────────────────────────────────────

export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // YYYY/MM/DD
  const isoSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (isoSlash) return `${isoSlash[1]}-${isoSlash[2].padStart(2, "0")}-${isoSlash[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // YYYYMMDD
  const ymd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
}

// ─── Amount parsing (Swedish: "1 234,56" or "-1234.56") ──────────────────────

export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Remove "kr", "SEK", spaces (incl nbsp), plus sign
  s = s.replace(/\s|\u00A0|kr|sek|\+/gi, "");
  // If both . and , present: assume . is thousand sep, , is decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Auto-categorization heuristics (Swedish merchants) ─────────────────────

const KEYWORDS: { match: RegExp; cat: string }[] = [
  { match: /\b(ica|coop|willys|hemköp|lidl|city ?gross|matrebellerna|tempo|stora coop)\b/i, cat: "mat" },
  { match: /\b(restaurang|pizzeria|sushi|max|mcdonalds?|burger king|espresso ?house|wayne'?s|foodora|wolt|uber ?eats)\b/i, cat: "mat" },
  { match: /\b(sl|västtrafik|skånetrafiken|mtr|sj |swebus|flygbussar|taxi|uber|bolt|circle ?k|okq8|preem|st1|shell|ingo|tesla supercharger)\b/i, cat: "transport" },
  { match: /\b(spotify|netflix|hbo|disney ?plus|viaplay|apple\.com\/bill|google ?one|youtube ?premium|microsoft|adobe|storytel|nextory)\b/i, cat: "abonnemang" },
  { match: /\b(fortum|vattenfall|eon|telia|tele2|telenor|tre |comhem|bahnhof|hyra|brf|riksbyggen|hsb)\b/i, cat: "boende" },
  { match: /\b(systembolag|bar |pub |biljett|filmstaden|sf bio|tivoli|gröna lund|liseberg|spotify|steam|playstation|xbox)\b/i, cat: "noje" },
  { match: /\b(h&m|zara|cubus|lindex|kappahl|nelly|zalando|stadium|intersport|elgiganten|mediamarkt|kjell|clas ohlson|ikea|jysk)\b/i, cat: "shopping" },
  { match: /\b(booking|hotels|airbnb|sas |norwegian|tui |ving |apollo|finnair|ryanair)\b/i, cat: "resor" },
];

export function suggestCategory(description: string, categories: Category[]): string {
  const fallback = categories.find((c) => c.id === "ovrigt")?.id ?? categories[categories.length - 1]?.id ?? "";
  for (const k of KEYWORDS) {
    if (k.match.test(description)) {
      const found = categories.find((c) => c.id === k.cat || c.name.toLowerCase() === k.cat);
      if (found) return found.id;
    }
  }
  return fallback;
}

// ─── Build staged transactions ───────────────────────────────────────────────

const dedupKey = (date: string, amount: number, desc: string) =>
  `${date}__${amount.toFixed(2)}__${desc.trim().toLowerCase().slice(0, 40)}`;

export function buildStaged(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  categories: Category[],
  existingTx: Transaction[],
): StagedTx[] {
  const existing = new Set(existingTx.map((t) => dedupKey(t.date, t.amount, t.description)));
  const seen = new Set<string>();
  const staged: StagedTx[] = [];

  rows.forEach((row, i) => {
    const dateStr = parseDate(row[mapping.date] ?? "");
    const amount = parseAmount(row[mapping.amount] ?? "");
    const desc = (row[mapping.description] ?? "").trim();
    if (!dateStr || amount == null || amount === 0 || !desc) return;

    const type: "expense" | "income" = amount < 0 ? "expense" : "income";
    const absAmount = Math.abs(amount);
    const categoryId = suggestCategory(desc, categories);
    const key = dedupKey(dateStr, absAmount, desc);
    const isDup = existing.has(key) || seen.has(key);
    seen.add(key);
    staged.push({
      rowIndex: i,
      date: dateStr,
      amount: absAmount,
      type,
      description: desc,
      categoryId,
      isDuplicate: isDup,
      selected: !isDup,
    });
  });

  return staged;
}

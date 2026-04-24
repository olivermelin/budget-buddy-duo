import { Transaction, Category, Person } from "@/types/budget";
import { sek } from "./format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportInput {
  transactions: Transaction[];
  categories: Category[];
  persons: Person[];
}

const enrich = ({ transactions, categories, persons }: ExportInput) => {
  const cm = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const pm = Object.fromEntries(persons.map(p => [p.id, p.name]));
  return transactions.map(t => ({
    Datum: new Date(t.date).toLocaleDateString("sv-SE"),
    Beskrivning: t.description,
    Kategori: cm[t.categoryId] ?? t.categoryId,
    Betalare: pm[t.payerId] ?? t.payerId,
    Typ: t.type === "income" ? "Inkomst" : "Utgift",
    Belopp: t.type === "income" ? t.amount : -t.amount,
  }));
};

export function exportTransactionsXLSX(input: ExportInput) {
  const rows = enrich(input);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaktioner");
  XLSX.writeFile(wb, `budgetbuddy-transaktioner-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportTransactionsPDF(input: ExportInput) {
  const rows = enrich(input);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("BudgetBuddy – Transaktioner", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleDateString("sv-SE"), 14, 24);

  const total = rows.reduce((s, r) => s + r.Belopp, 0);

  autoTable(doc, {
    startY: 30,
    head: [["Datum", "Beskrivning", "Kategori", "Betalare", "Typ", "Belopp"]],
    body: rows.map(r => [r.Datum, r.Beskrivning, r.Kategori, r.Betalare, r.Typ, sek(r.Belopp)]),
    foot: [["", "", "", "", "Summa", sek(total)]],
    headStyles: { fillColor: [30, 41, 79], textColor: 255 },
    footStyles: { fillColor: [240, 240, 244], textColor: 30, fontStyle: "bold" },
    styles: { font: "helvetica", fontSize: 9 },
    columnStyles: { 5: { halign: "right" } },
  });

  doc.save(`budgetbuddy-transaktioner-${new Date().toISOString().slice(0, 10)}.pdf`);
}

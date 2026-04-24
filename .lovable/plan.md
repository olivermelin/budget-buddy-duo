
# BudgetBuddy – Plan för v1

En modern, premium budgetapp för par/hushåll. Allt på **svenska**, valuta i **SEK**. Data sparas lokalt i webbläsaren (mockdata + localStorage) så du kan börja använda direkt – redo att kopplas till backend senare.

## Designspråk
- **Färger:** Deep navy (primär), emerald green (positivt), soft red (varning), light gray bakgrunder, mycket vit yta.
- **Stil:** Rounded corners, soft shadows, generös whitespace, tydlig typografi (Inter), smooth animationer.
- **Tema:** Ljust som standard, **dark mode**-toggle i headern.
- **Responsivt:** Mobil-först med bottom nav på liten skärm, sidebar på desktop.

## Sidstruktur

**1. Dashboard (startsida)**
- Hero-kort: "Kvar att leva på" denna månad – stort och tydligt.
- KPI-rad: Inkomster · Fasta utgifter · Rörliga utgifter · Sparande.
- Jämförelse mot förra månaden (▲/▼ med procent).
- Smarta insikter-kort: t.ex. *"Ni spenderade 18% mindre på mat"*, *"Sparmålet är 72% uppnått"*.
- Snabb-CTA: "+ Lägg till utgift" (öppnar modal från valfri sida).
- Senaste transaktioner (5 st).

**2. Budget**
- Kategorier: Mat, Boende, Transport, Nöje, Shopping, Abonnemang, Resor, Övrigt (kan redigeras).
- Per kategori: månadsbudget, spenderat, **progress bar** (grön → gul → röd).
- Varning vid ~85%, röd markering vid överskridning.
- Klick på kategori → drilldown med transaktionerna.

**3. Transaktioner**
- Lista med datum, belopp, kategori-tag, vem som betalade (Person 1 / Person 2), kommentar.
- Filter: månad, kategori, person, fritext-sök.
- Snabb input via modal: belopp, datum (shadcn datepicker), kategori, betalare, valfri kommentar.
- **Export till Excel/PDF** (knapp uppe till höger – exporterar aktuellt filter).

**4. Parläge / Delad ekonomi**
- Två profiler (Person 1 & Person 2) med namn/avatar, redigerbara i Inställningar.
- Sammanställning per person: totalt betalat denna månad.
- **Rättvis fördelning**: appen räknar ut vem som ligger ute med pengar och hur mycket som ska överföras för att jämna ut.
- Valbar fördelningsmodell: 50/50 eller proportionerligt mot inkomst.

**5. Sparmål**
- Skapa mål: namn (Resa, Buffert, Bil, Renovering...), målsumma, måldatum, ikon.
- Per mål: sparat hittills, progress bar, **prognos** för när målet nås baserat på snittsparande.
- Lägg till insättning med ett klick. Liten gamification: badge när 25/50/75/100% nås.

**6. Statistik**
- Linjediagram: ekonomi-trend senaste 6 månaderna.
- Pie chart: kategorifördelning för vald månad.
- Bar chart: inkomst vs utgift per månad.
- Sparutveckling över tid.
- (recharts för alla diagram.)

**7. Årsöversikt**
- 12-månaders heatmap/översikt: inkomst, utgift, sparande per månad.
- Topp 3 kategorier på året, total sparad summa, snitt per månad.
- Jämför månad mot månad.

**8. Prenumerationsdetektor**
- Egen vy som automatiskt identifierar återkommande utgifter (samma beskrivning/belopp varje månad).
- Lista över hittade abonnemang med totalkostnad/månad och /år.
- Möjlighet att markera som "aktiv" eller "avsluta" (påminnelse).

**9. Inställningar**
- Hushållsnamn, Person 1 & Person 2 (namn, färg, inkomst).
- Kategorier (lägg till/redigera/ta bort + sätt budget).
- Tema (ljust/mörkt/system).
- Återställ mockdata / rensa data.

## Mockdata
- 2 personer, ~3 månader transaktionshistorik, 8 kategorier med satta budgetar, 2–3 sparmål med pågående progress, några återkommande prenumerationer (Spotify, Netflix, gym) – så att alla diagram, insikter och detektorn fungerar direkt.

## Teknik
- React + TypeScript + Tailwind + shadcn/ui.
- recharts för diagram.
- localStorage för persistens, strukturerad data-layer så backend (Lovable Cloud) kan kopplas in senare utan att skriva om UI.
- xlsx + jsPDF för export.
- Komponentbaserad struktur (`/components/dashboard`, `/budget`, `/transactions` etc.).

## Det här ingår INTE i v1 (kan läggas till senare)
- Inloggning / molnsync (Lovable Cloud).
- AI-insikter och "Kan vi unna oss detta?"-kalkylator.
- Riktig bankkoppling.

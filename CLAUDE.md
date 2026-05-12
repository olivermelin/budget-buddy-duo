# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vad är detta

Budgetapp för par och hushåll med svensk UI. React 18 + TypeScript + Vite + Supabase (PostgreSQL, Auth, Realtime) + shadcn/ui + Tailwind CSS + Recharts.

## Kommandon

```bash
npm run dev              # starta dev-server (port 8080)
npm run build            # produktionsbygg
npm run lint             # ESLint
npm run test             # kör alla tester (Vitest, run-läge)
npm run test:watch       # kör tester i watch-läge
npx vitest run src/test/foo.test.ts   # kör ett enskilt testfil
```

## Arkitektur

### Provider-hierarki (App.tsx)
```
QueryClientProvider
  AuthProvider          ← Google OAuth, householdId, households-lista
    BudgetProvider      ← AppState (useReducer), Supabase-synk, realtime
      AppShell          ← layout + routing (RequireAuth + RequireHousehold guards)
```

### State-hantering (`src/store/`)
Uppdelad i två filer:
- `reducer.ts` — ren reducer-funktion + `Action`-unionen, inga bieffekter
- `budget-store.tsx` — `BudgetProvider` + `useBudget()` hook; här sker Supabase-laddning, `writeToSupabase()`, och Realtime-prenumerationer

**Optimistiska uppdateringar:** `dispatch(action)` → lokal state uppdateras direkt → `writeToSupabase(action, householdId, userId)` körs asynkront. Vid fel: toast + `reload()` för att återställa.

**Realtime:** Supabase-kanalen `hh-{householdId}` lyssnar på postgres_changes för alla relevanta tabeller och kallar `reload()` vid ändringar från andra klienter.

**Automatisk inkomst-synk:** När en `UPSERT_RECURRING` med `type: "income"` dispatckas synkroniseras personens `income`-fält automatiskt till summan av alla aktiva återkommande inkomster.

### Datamodell (`src/types/budget.ts`)
Centrala typer: `AppState`, `Transaction`, `Category`, `Person`, `SavingsGoal`, `Loan`, `RecurringTransaction`, `ImportRule`, `Subscription` (beräknad, inte lagrad).

`Subscription` är inte en databastyp — den beräknas i `detectSubscriptions()` i `analytics.ts` utifrån återkommande transaktionsmönster.

### Supabase-tabeller → TypeScript-fältmappning
Kolumnnamn i databasen är snake_case; de mappas i `loadHouseholdData()`:
- `payer_user_id` → `payerId`
- `category_id` → `categoryId`
- `budget_monthly` → `budget`
- `income_monthly` → `income`
- `owner_user_id` → `ownerId`
- `household_id` filtreras på i varje query och varje write (defence-in-depth utöver RLS)

### Routing (App.tsx)
Svenska URL-sökvägar: `/transaktioner`, `/sparmal`, `/lan`, `/statistik`, `/arsoversikt`, `/prenumerationer`, `/installningar`, `/parlage`, `/import`.

Publika rutter: `/login`, `/auth/callback`, `/integritetspolicy`, `/onboarding`.

### Analytikfunktioner (`src/lib/analytics.ts`)
- `summarizeMonth()` — inkomst/utgift/sparande per månad
- `calcSplit()` — beräknar vem som ska betala vem (50/50 eller inkomstbaserat)
- `buildMonthPlan()` — planerat vs faktiskt baserat på återkommande transaktioner
- `detectSubscriptions()` — hittar prenumerationsmönster i transaktionshistoriken
- `computeEffectiveBudgets()` — fasta kategoriers budget = summa aktiva återkommande utgifter

**Viktigt:** `inMonth()` parsar ISO-datum som lokal tid (`"YYYY-MM-DD".split("-")`) för att undvika UTC-midnatt-skift. Gör detsamma i ny kod som jämför datum.

### Viktiga lib-filer
- `src/lib/format.ts` — `sek()`, `pct()`, `monthKey()`, `dateLabel()` m.fl.
- `src/lib/export.ts` — XLSX/PDF-export via jspdf + xlsx
- `src/lib/supabase.ts` — Supabase-klientinstansen
- `src/lib/sentry.ts` — Sentry-wrapper

## Konventioner
- Svensk UI-text genomgående
- Alla Supabase-queries filtreras på `household_id`
- Använd befintliga shadcn/ui-komponenter (`src/components/ui/`)
- Inga onödiga abstraktioner

## Tester
Testfiler i `src/**/*.{test,spec}.{ts,tsx}`, körs med jsdom. Setup i `src/test/setup.ts` (mockar `matchMedia`). Mocka Supabase-klienten i enhetstester. Namnge `describe`/`it`-block på svenska.

## Agent-roller
Se [agents.md](agents.md) för specialiserade agentroller: Arkitekt, Utvecklare, Testare, UX-expert, Säkerhetsansvarig — koordinerade av Lead Developer.

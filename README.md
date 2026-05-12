# Budget Buddy Duo

Budgetapp för par och hushåll. Håll koll på gemensamma utgifter, sparmål och lån — i realtid.

## Funktioner

- **Transaktioner** — lägg till, redigera och filtrera utgifter och inkomster per kategori och person
- **Budget** — sätt månadsbudgetar per kategori, fasta vs rörliga utgifter
- **Statistik** — månads- och årsöversikter med diagram (Recharts)
- **Sparmål** — gemensamma och individuella mål med insättningar och snapshots
- **Lån** — spåra amorteringar och extra betalningar per lån
- **Prenumerationer** — automatisk detektering av återkommande utgifter
- **Återkommande transaktioner** — mallar som auto-genererar transaktioner varje månad
- **Par-läge** — kostnadsfördelning 50/50 eller inkomstbaserat, med utjämningsförslag
- **Import** — importera transaktioner via CSV med regelmotor för auto-kategoriisering
- **Realtidssynk** — ändringar syns direkt hos alla hushållsmedlemmar via Supabase Realtime

## Teknikstack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui, Tailwind CSS, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Auth:** Google OAuth via Supabase
- **Export:** XLSX + PDF (jspdf, xlsx)
- **Felrapportering:** Sentry

## Kom igång

```bash
# Installera beroenden
npm install

# Starta dev-server (port 8080)
npm run dev

# Bygg för produktion
npm run build

# Kör tester
npm run test

# Lint
npm run lint
```

### Miljövariabler

Skapa en `.env.local` med dina Supabase-uppgifter:

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-nyckel>
```

## Projektstruktur

```
src/
  pages/          — sidkomponenter (Dashboard, Budget, Transactions, ...)
  components/     — delade komponenter + ui/ (shadcn)
  store/          — budget-store.tsx (state + Supabase-synk), reducer.ts
  context/        — AuthContext.tsx (auth + hushållshantering)
  lib/            — supabase, sentry, format, export, analytics
  types/          — budget.ts (alla TypeScript-typer)
  test/           — Vitest-tester
supabase/
  migrations/     — SQL-migrationer (schema, RLS, RPC)
```

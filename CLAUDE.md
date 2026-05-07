# Budget Buddy Duo

Budgetapp för par och hushåll. Svensk UI.

## Teknikstack
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL, Auth, Realtime)
- shadcn/ui + Tailwind CSS + Recharts
- State: useReducer + Context i `src/store/budget-store.tsx`
- Auth: Google OAuth via Supabase i `src/context/AuthContext.tsx`

## Projektstruktur
```
src/
  pages/          — sidkomponenter
  components/     — delade + ui/ (shadcn)
  store/          — budget-store.tsx (central state + Supabase-synk)
  context/        — AuthContext.tsx
  lib/            — supabase, sentry, format, export, analytics
  types/          — budget.ts (alla typer)
  test/           — Vitest-tester
supabase/
  migrations/     — 5 SQL-migrationer (schema, RLS, RPC)
```

## Konventioner
- Svensk UI-text genomgående
- Optimistiska uppdateringar: dispatch lokalt, sedan `writeToSupabase()`
- Alla queries filtreras på `household_id`
- Använd befintliga shadcn/ui-komponenter
- Inga onödiga abstraktioner

## Agent-roller
Se [agents.md](agents.md) för specialiserade agentroller:
Arkitekt, Utvecklare, Testare, UX-expert, Säkerhetsansvarig — koordinerade av Lead Developer.

## Kommandon
```bash
npm run dev        # starta dev-server
npm run build      # produktionsbygg
npm run test       # kör tester (Vitest)
npm run lint       # ESLint
```

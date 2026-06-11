-- Realtime-publikationen saknade två tabeller som klienten prenumererar på
-- (kanalen hh-{householdId} i budget-store.tsx). Utan dessa får andra klienter
-- inga live-uppdateringar för återkommande transaktioner och importregler.
alter publication supabase_realtime add table recurring_transactions;
alter publication supabase_realtime add table import_rules;

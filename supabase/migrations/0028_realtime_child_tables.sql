-- Realtime: lägg till sub-tabeller så att sparbidrag, snapshots, låneavbetalningar
-- och prenumerationsstatus syns live hos andra klienter. Klienten (budget-store.tsx,
-- kanalen hh-{householdId}) prenumererar nu på dessa; utan dem i publikationen
-- emitteras inga postgres_changes-händelser och en partners sparbidrag/avbetalning
-- syns inte förrän en orelaterad ändring råkar trigga en reload.
alter publication supabase_realtime add table subscription_overrides;
alter publication supabase_realtime add table savings_contributions;
alter publication supabase_realtime add table savings_snapshots;
alter publication supabase_realtime add table loan_payments;

-- BudgetBuddy – funktionshärdning (2026-06-10)
--
-- Åtgärdar två WARN-fynd från Supabase säkerhetsrådgivare (get_advisors):
--
-- 1. "Function Search Path Mutable": funktioner utan låst search_path kan
--    kapas via skuggobjekt i scheman som angriparen kan skriva till — extra
--    allvarligt för SECURITY DEFINER. Fix: lås search_path till public, pg_temp.
--    Alla funktionskroppar refererar antingen public-tabeller (okvalificerat,
--    täcks av public) eller auth.* (skemakvalificerat), så beteendet ändras inte.
--
-- 2. "Public Can Execute SECURITY DEFINER Function": Postgres ger EXECUTE till
--    PUBLIC som standard, så anon kunde anropa alla RPC:er via /rest/v1/rpc/.
--    Fix: återkalla från PUBLIC och anon, ge uttryckligen till authenticated
--    (+ service_role). Triggerfunktioner ska inte kunna anropas via RPC alls.
--
-- OBS: CREATE OR REPLACE behåller befintliga rättigheter, men om en framtida
-- migration DROP:ar och återskapar någon funktion återställs EXECUTE till
-- PUBLIC — upprepa då revoke/grant nedan för den funktionen.

-- ─── 1. Låst search_path ──────────────────────────────────────────────────────

alter function public.is_household_member(uuid)                            set search_path = public, pg_temp;
alter function public.seed_default_categories(uuid)                        set search_path = public, pg_temp;
alter function public.join_household(text)                                 set search_path = public, pg_temp;
alter function public.create_household_with_owner(text, text, text, text)  set search_path = public, pg_temp;
alter function public.increment_goal_saved(uuid, numeric)                  set search_path = public, pg_temp;
alter function public.decrement_loan_balance(uuid, numeric)                set search_path = public, pg_temp;
alter function public.delete_my_account()                                  set search_path = public, pg_temp;
alter function public.prevent_role_change()                                set search_path = public, pg_temp;
alter function public.enforce_private_owner()                              set search_path = public, pg_temp;

-- ─── 2. EXECUTE-rättigheter ───────────────────────────────────────────────────

-- RPC:er som kräver inloggning: endast authenticated (+ service_role).
-- revoke från PUBLIC är det som faktiskt biter — anon har inget eget grant
-- utan ärver via PUBLIC; anon tas med för tydlighets skull.

revoke execute on function public.increment_goal_saved(uuid, numeric)                 from public, anon;
grant  execute on function public.increment_goal_saved(uuid, numeric)                 to authenticated, service_role;

revoke execute on function public.decrement_loan_balance(uuid, numeric)               from public, anon;
grant  execute on function public.decrement_loan_balance(uuid, numeric)               to authenticated, service_role;

revoke execute on function public.create_household_with_owner(text, text, text, text) from public, anon;
grant  execute on function public.create_household_with_owner(text, text, text, text) to authenticated, service_role;

revoke execute on function public.join_household(text)                                from public, anon;
grant  execute on function public.join_household(text)                                to authenticated, service_role;

revoke execute on function public.delete_my_account()                                 from public, anon;
grant  execute on function public.delete_my_account()                                 to authenticated, service_role;

revoke execute on function public.seed_default_categories(uuid)                       from public, anon;
grant  execute on function public.seed_default_categories(uuid)                       to authenticated, service_role;

-- is_household_member anropas i RLS-policys och av andra SECURITY DEFINER-
-- funktioner; authenticated måste därför ha EXECUTE. anon behöver den inte —
-- oautentiserade tabellfrågor ger nu "permission denied" i stället för tom
-- lista, vilket är likvärdigt (appen gör aldrig anrop utan inloggning).
revoke execute on function public.is_household_member(uuid) from public, anon;
grant  execute on function public.is_household_member(uuid) to authenticated, service_role;

-- Triggerfunktioner ska aldrig anropas direkt. EXECUTE-kontrollen för triggers
-- sker vid CREATE TRIGGER (mot tabellägaren), inte när triggern avfyras, så
-- befintliga triggers fortsätter att fungera.
revoke execute on function public.prevent_role_change()   from public, anon, authenticated;
revoke execute on function public.enforce_private_owner() from public, anon, authenticated;

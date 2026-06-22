-- Ägarmedveten RLS för sparmål och låneavbetalningar.
--
-- owner_id/owner_user_id infördes (0008 resp. 0009) för att stödja PRIVATA
-- sparmål och lån, men bara lånraderna (0009) fick ägarmedveten policy.
-- savings_goals, savings_contributions, savings_snapshots och loan_payments
-- skyddades fortfarande bara av is_household_member(...) — alltså kunde vilken
-- hushållsmedlem som helst läsa/ändra/radera en annans "privata" sparmål eller
-- avbetalningar på ett privat lån. Detta speglar nu loans-policyn från 0009.

-- ── savings_goals: privat mål bara synligt/ändringsbart för ägaren ───────────
drop policy if exists "household full access" on savings_goals;
create policy "savings owner-aware access" on savings_goals for all
  using      (is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()))
  with check (is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()));

-- ── savings_contributions: ärver ägarkoll via parent-målet ───────────────────
drop policy if exists "household full access" on savings_contributions;
create policy "savings contributions owner-aware" on savings_contributions for all
  using (exists (
    select 1 from savings_goals g
    where g.id = goal_id
      and is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())))
  with check (exists (
    select 1 from savings_goals g
    where g.id = goal_id
      and is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())));

-- ── savings_snapshots: ärver ägarkoll via parent-målet ───────────────────────
drop policy if exists "household full access" on savings_snapshots;
create policy "savings snapshots owner-aware" on savings_snapshots for all
  using (exists (
    select 1 from savings_goals g
    where g.id = goal_id
      and is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())))
  with check (exists (
    select 1 from savings_goals g
    where g.id = goal_id
      and is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())));

-- ── loan_payments: ärver ägarkoll via parent-lånet ───────────────────────────
drop policy if exists "household full access" on loan_payments;
create policy "loan payments owner-aware" on loan_payments for all
  using (exists (
    select 1 from loans l
    where l.id = loan_id
      and is_household_member(l.household_id)
      and (l.owner_user_id is null or l.owner_user_id = auth.uid())))
  with check (exists (
    select 1 from loans l
    where l.id = loan_id
      and is_household_member(l.household_id)
      and (l.owner_user_id is null or l.owner_user_id = auth.uid())));

-- ── increment_goal_saved: lägg till ägarkoll (SECURITY DEFINER-vägen) ─────────
-- CREATE OR REPLACE bevarar befintliga EXECUTE-grants (revoke från PUBLIC/anon i 0026).
create or replace function public.increment_goal_saved(gid uuid, delta numeric)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if delta <= 0 then
    raise exception 'Delta must be positive';
  end if;

  if not exists (
    select 1 from savings_goals g
    where g.id = gid
      and is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())
  ) then
    raise exception 'Access denied';
  end if;

  update savings_goals set saved = saved + delta where id = gid;
end;
$function$;

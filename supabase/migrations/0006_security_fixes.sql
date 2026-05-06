-- BudgetBuddy – säkerhetsfix (2026-05-06)
-- Åtgärdar tre kritiska/höga fynd från säkerhetsrevision.
--
-- Fynd 4 (KRITISK): household_members INSERT-policy tillät fri access
-- Fynd 1 (KRITISK): increment_goal_saved saknade auth- och behörighetskontroll
-- Fynd 5 (HÖG):    Privilege escalation – member kunde sätta role = 'owner'

-- ─── Fynd 4: Lås INSERT på household_members till RPC-only ────────────────────
-- All insertion sker via create_household_with_owner och join_household
-- (båda SECURITY DEFINER och kringgår RLS). Direkt INSERT via anon-nyckel blockeras.

drop policy if exists "auth can insert" on household_members;

create policy "rpc only insert" on household_members
  for insert with check (false);

-- ─── Fynd 1: Lägg till auth + membership-kontroll i increment_goal_saved ──────
-- Utan detta kunde en inloggad angripare manipulera saved-beloppet på
-- godtyckliga sparmål i hushåll de inte tillhör.

create or replace function increment_goal_saved(gid uuid, delta numeric)
returns void language plpgsql security definer as $$
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
  ) then
    raise exception 'Access denied';
  end if;

  update savings_goals set saved = saved + delta where id = gid;
end;
$$;

-- ─── Fynd 5: Förhindra privilege escalation via trigger ───────────────────────
-- WITH CHECK i policy kan inte jämföra NEW.role med OLD.role.
-- En trigger löser det korrekt utan att blockera legitima profiluppdateringar
-- (display_name, person_color, income_monthly) för owners och members.

create or replace function prevent_role_change()
returns trigger language plpgsql as $$
begin
  if NEW.role != OLD.role then
    raise exception 'Role cannot be changed via API';
  end if;
  return NEW;
end;
$$;

create trigger no_role_escalation
  before update on household_members
  for each row execute function prevent_role_change();

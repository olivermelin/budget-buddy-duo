-- Invite hardening (2026-05-07)
--
-- Fynd 3 (HÖG):  join_household saknar rate limiting – öppen för brute force av koder.
-- Fynd 11 (MEDEL): Obegränsat antal aktiva inbjudningskoder per hushåll.
--
-- Åtgärder:
--   1. Tabell invite_attempts – loggar misslyckade försök per användare.
--   2. join_household uppdateras med auth-check + rate limit (max 10/timme).
--   3. Inga fler SQL-förändringar för Fynd 11 – hanteras i klientkoden
--      (gamla koder deaktiveras i Settings.tsx innan ny skapas).

-- ─── 1. Tabell för rate limiting ──────────────────────────────────────────────

create table invite_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

alter table invite_attempts enable row level security;

-- Användare ser bara sina egna försök; INSERT sker via SECURITY DEFINER-funktion.
create policy "own rows" on invite_attempts
  for select using (user_id = auth.uid());

create policy "insert via rpc only" on invite_attempts
  for insert with check (false);

-- Index för snabb räkning per användare och tid
create index invite_attempts_user_time_idx
  on invite_attempts (user_id, attempted_at desc);

-- ─── 2. Uppdaterad join_household med auth + rate limit ───────────────────────

create or replace function join_household(code text)
returns uuid language plpgsql security definer as $$
declare
  inv           household_invites%rowtype;
  display       text;
  attempt_count int;
begin
  -- Kräv inloggning
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Rate limit: max 10 försök per användare per timme
  select count(*) into attempt_count
  from invite_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '1 hour';

  if attempt_count >= 10 then
    raise exception 'För många försök. Vänta en stund och försök igen.';
  end if;

  -- Slå upp koden
  select * into inv
  from household_invites
  where invite_code = upper(code)
    and expires_at > now()
    and used_by is null;

  if not found then
    -- Logga misslyckat försök (INSERT kringgår RLS via SECURITY DEFINER)
    insert into invite_attempts (user_id) values (auth.uid());
    raise exception 'Ogiltig eller utgången inbjudningskod';
  end if;

  -- Hämta visningsnamn från auth
  select coalesce(raw_user_meta_data->>'full_name', email) into display
  from auth.users where id = auth.uid();

  insert into household_members (household_id, user_id, display_name, role, person_color)
  values (inv.household_id, auth.uid(), coalesce(display, 'Person 2'), 'member', '#ec4899')
  on conflict do nothing;

  update household_invites set used_by = auth.uid() where id = inv.id;

  return inv.household_id;
end;
$$;

-- Loans security hardening (2026-05-06)
--
-- Fynd A (KRITISK): loans SELECT policy avslöjar privata lån för alla hushållsmedlemmar.
--   owner_user_id IS NOT NULL ska begränsa synlighet till ägaren.
--
-- Fynd B (KRITISK): decrement_loan_balance saknar auth- och ägarskontroll.
--   En inloggad angripare kan nolla ut valfritt lån i systemet.

-- ─── Fynd A: Ersätt "household full access" med ägarmedveten policy ─────────────
-- Nuvarande policy låter alla hushållsmedlemmar läsa/skriva ALLA lån.
-- Ny policy: delade lån (owner_user_id IS NULL) = alla i hushållet;
--            privata lån (owner_user_id IS NOT NULL) = endast ägaren.

drop policy if exists "household full access" on loans;

create policy "household owner-aware access" on loans for all
  using (
    is_household_member(household_id)
    and (owner_user_id is null or owner_user_id = auth.uid())
  )
  with check (
    is_household_member(household_id)
    and (owner_user_id is null or owner_user_id = auth.uid())
  );

-- ─── Fynd B: Lägg till auth + ägarskontroll i decrement_loan_balance ──────────
-- Utan detta kan en autentiserad angripare manipulera saldot på
-- godtyckliga lån i hushåll de inte tillhör, eller på andras privata lån.

create or replace function decrement_loan_balance(lid uuid, delta numeric)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if delta <= 0 then
    raise exception 'Delta must be positive';
  end if;

  if not exists (
    select 1 from loans l
    where l.id = lid
      and is_household_member(l.household_id)
      and (l.owner_user_id is null or l.owner_user_id = auth.uid())
  ) then
    raise exception 'Access denied';
  end if;

  update loans
  set current_balance = greatest(0, current_balance - delta),
      updated_at = now()
  where id = lid;
end;
$$;

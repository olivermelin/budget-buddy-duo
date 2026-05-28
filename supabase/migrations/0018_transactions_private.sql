-- Privata transaktioner och återkommande mallar
-- Rader med is_private=true syns endast för ägaren (owner_user_id),
-- även om de tillhör samma hushåll.

alter table transactions
  add column if not exists is_private boolean not null default false,
  add column if not exists owner_user_id uuid references auth.users(id);

alter table recurring_transactions
  add column if not exists is_private boolean not null default false,
  add column if not exists owner_user_id uuid references auth.users(id);

create index if not exists transactions_owner_private_idx
  on transactions(owner_user_id) where is_private;
create index if not exists recurring_owner_private_idx
  on recurring_transactions(owner_user_id) where is_private;

-- ─── Ersätt befintliga "household full access"-policyn med uppdelade policys ───

drop policy if exists "household full access" on transactions;

create policy "transactions select" on transactions
  for select using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "transactions insert" on transactions
  for insert with check (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "transactions update" on transactions
  for update using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  ) with check (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "transactions delete" on transactions
  for delete using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

drop policy if exists "household full access" on recurring_transactions;

create policy "recurring select" on recurring_transactions
  for select using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "recurring insert" on recurring_transactions
  for insert with check (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "recurring update" on recurring_transactions
  for update using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  ) with check (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

create policy "recurring delete" on recurring_transactions
  for delete using (
    is_household_member(household_id)
    and (is_private = false or owner_user_id = auth.uid())
  );

-- ─── Defence in depth: trigger som tvingar ownership på privata rader ─────────

create or replace function enforce_private_owner()
returns trigger language plpgsql security definer as $$
begin
  if new.is_private then
    new.owner_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_private_owner on transactions;
create trigger transactions_private_owner
  before insert or update on transactions
  for each row execute function enforce_private_owner();

drop trigger if exists recurring_private_owner on recurring_transactions;
create trigger recurring_private_owner
  before insert or update on recurring_transactions
  for each row execute function enforce_private_owner();

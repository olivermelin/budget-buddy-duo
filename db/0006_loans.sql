-- Loans / debt tracking
-- Run this in Supabase Dashboard → SQL Editor

create table loans (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('mortgage','car','student','personal','credit_card','other')),
  lender          text not null default '',
  original_amount numeric not null check (original_amount >= 0),
  current_balance numeric not null check (current_balance >= 0),
  interest_rate   numeric not null default 0,
  monthly_payment numeric not null default 0,
  monthly_amortization numeric not null default 0,
  start_date      date,
  end_date        date,
  owner_user_id   uuid references auth.users(id) on delete set null,
  owner_share     numeric not null default 100,
  icon            text not null default '💰',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table loan_payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references loans(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  date        date not null default current_date,
  amount      numeric not null check (amount > 0),
  is_extra    boolean not null default false,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

alter table loans          enable row level security;
alter table loan_payments  enable row level security;

create policy "household full access" on loans for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household full access" on loan_payments for all
  using (exists (select 1 from loans l where l.id = loan_id and is_household_member(l.household_id)))
  with check (exists (select 1 from loans l where l.id = loan_id and is_household_member(l.household_id)));

create or replace function decrement_loan_balance(lid uuid, delta numeric)
returns void language sql security definer as $$
  update loans set current_balance = greatest(0, current_balance - delta), updated_at = now() where id = lid;
$$;

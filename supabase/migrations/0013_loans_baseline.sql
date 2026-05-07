-- Lån & skulder – basschema (idempotent)
-- OBS: Denna migration kördes manuellt via SQL Editor innan CLI-migrationer sattes upp.
-- Använder CREATE TABLE IF NOT EXISTS så att den är säker att köra igen på ny databas.
-- Säkerhetspatchar för loans finns i 0009_loans_security.sql.

create table if not exists loans (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  name                 text not null,
  type                 text not null check (type in ('mortgage','car','student','personal','credit_card','other')),
  lender               text not null default '',
  original_amount      numeric not null check (original_amount >= 0),
  current_balance      numeric not null check (current_balance >= 0),
  interest_rate        numeric not null default 0,
  monthly_payment      numeric not null default 0,
  monthly_amortization numeric not null default 0,
  start_date           date,
  end_date             date,
  owner_user_id        uuid references auth.users(id) on delete set null,
  owner_share          numeric not null default 100,
  icon                 text not null default '💰',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists loan_payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references loans(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  date        date not null default current_date,
  amount      numeric not null check (amount > 0),
  is_extra    boolean not null default false,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- RLS aktiveras (safe to re-run)
alter table loans         enable row level security;
alter table loan_payments enable row level security;

-- Baspolicy för loan_payments (loans-policyn ersätts av 0009_loans_security.sql)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'loan_payments' and policyname = 'household full access'
  ) then
    execute $p$
      create policy "household full access" on loan_payments for all
        using (exists (select 1 from loans l where l.id = loan_id and is_household_member(l.household_id)))
        with check (exists (select 1 from loans l where l.id = loan_id and is_household_member(l.household_id)))
    $p$;
  end if;
end $$;

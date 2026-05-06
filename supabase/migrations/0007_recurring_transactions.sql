-- Recurring transaction templates
-- Automatically generates transactions each month on a set day

create table recurring_transactions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  description          text not null,
  amount               numeric not null check (amount > 0),
  type                 text not null check (type in ('expense', 'income')),
  category_id          uuid references categories(id) on delete set null,
  payer_user_id        uuid references auth.users(id) on delete set null,
  day_of_month         int not null check (day_of_month between 1 and 31),
  is_active            boolean not null default true,
  last_generated_month text,  -- 'YYYY-MM', null = never generated
  created_at           timestamptz not null default now()
);

alter table recurring_transactions enable row level security;

create policy "household full access" on recurring_transactions
  for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

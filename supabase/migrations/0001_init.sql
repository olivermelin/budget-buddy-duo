-- BudgetBuddy – initial schema
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  split_mode  text not null default '50/50' check (split_mode in ('50/50', 'income')),
  created_at  timestamptz not null default now()
);

create table household_members (
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  person_color  text not null default '#6366f1',
  income_monthly numeric not null default 0,
  role          text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create table categories (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  name            text not null,
  icon            text not null default '📦',
  color           text not null,
  budget_monthly  numeric not null default 0,
  is_fixed        boolean not null default false,
  sort_order      int not null default 0
);

create table transactions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  date            date not null,
  amount          numeric not null check (amount > 0),
  type            text not null check (type in ('expense', 'income')),
  category_id     uuid references categories(id) on delete set null,
  payer_user_id   uuid references auth.users(id) on delete set null,
  description     text not null default '',
  is_recurring    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  icon          text not null default '🎯',
  target        numeric not null check (target > 0),
  saved         numeric not null default 0,
  target_date   date,
  created_at    timestamptz not null default now()
);

create table savings_contributions (
  id        uuid primary key default gen_random_uuid(),
  goal_id   uuid not null references savings_goals(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete set null,
  amount    numeric not null check (amount > 0),
  date      date not null default current_date,
  created_at timestamptz not null default now()
);

create table subscription_overrides (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  transaction_id  uuid not null references transactions(id) on delete cascade,
  is_active       boolean not null default true,
  unique (household_id, transaction_id)
);

create table household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  invite_code   text not null unique,
  created_by    uuid not null references auth.users(id) on delete cascade,
  expires_at    timestamptz not null default now() + interval '7 days',
  used_by       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table households             enable row level security;
alter table household_members      enable row level security;
alter table categories             enable row level security;
alter table transactions           enable row level security;
alter table savings_goals          enable row level security;
alter table savings_contributions  enable row level security;
alter table subscription_overrides enable row level security;
alter table household_invites      enable row level security;

-- Helper: is the current user a member of a given household?
create or replace function is_household_member(hid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- households
create policy "members can view"    on households for select  using (is_household_member(id));
create policy "members can update"  on households for update  using (is_household_member(id));
create policy "auth can create"     on households for insert  with check (auth.uid() is not null);

-- household_members
create policy "members can view"    on household_members for select using (is_household_member(household_id));
create policy "auth can insert"     on household_members for insert with check (auth.uid() is not null);
create policy "own row can update"  on household_members for update using (user_id = auth.uid());

-- categories / transactions / savings_goals / subscription_overrides – full access for household members
create policy "household full access" on categories             for all using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "household full access" on transactions           for all using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "household full access" on savings_goals          for all using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "household full access" on subscription_overrides for all using (is_household_member(household_id)) with check (is_household_member(household_id));

-- savings_contributions
create policy "household full access" on savings_contributions for all
  using (exists (select 1 from savings_goals g where g.id = goal_id and is_household_member(g.household_id)))
  with check (exists (select 1 from savings_goals g where g.id = goal_id and is_household_member(g.household_id)));

-- household_invites
create policy "members can view and create" on household_invites for all using (is_household_member(household_id)) with check (is_household_member(household_id) and created_by = auth.uid());

-- ─── Functions ────────────────────────────────────────────────────────────────

-- Seed default categories when a household is created
create or replace function seed_default_categories(hid uuid)
returns void language plpgsql security definer as $$
begin
  insert into categories (household_id, name, icon, color, budget_monthly, is_fixed, sort_order) values
    (hid, 'Mat & Hushåll', '🛒', '158 64% 42%', 5000, false, 1),
    (hid, 'Boende',        '🏠', '222 47% 17%', 8000, true,  2),
    (hid, 'Transport',     '🚗', '38 92% 50%',  2000, false, 3),
    (hid, 'Nöje',          '🎬', '271 77% 57%', 1500, false, 4),
    (hid, 'Shopping',      '👕', '340 75% 55%', 2000, false, 5),
    (hid, 'Abonnemang',    '📱', '198 84% 43%',  800, true,  6),
    (hid, 'Resor',         '✈️', '168 70% 38%', 3000, false, 7),
    (hid, 'Övrigt',        '📦', '215 16% 47%', 1000, false, 8);
end;
$$;

-- Join a household via invite code (atomic – no extra SELECT policy needed)
create or replace function join_household(code text)
returns uuid language plpgsql security definer as $$
declare
  inv household_invites%rowtype;
  display text;
begin
  select * into inv
  from household_invites
  where invite_code = upper(code)
    and expires_at > now()
    and used_by is null;

  if not found then
    raise exception 'Ogiltig eller utgången inbjudningskod';
  end if;

  select coalesce(raw_user_meta_data->>'full_name', email) into display
  from auth.users where id = auth.uid();

  insert into household_members (household_id, user_id, display_name, role, person_color)
  values (inv.household_id, auth.uid(), coalesce(display, 'Person 2'), 'member', '#ec4899')
  on conflict do nothing;

  update household_invites set used_by = auth.uid() where id = inv.id;

  return inv.household_id;
end;
$$;

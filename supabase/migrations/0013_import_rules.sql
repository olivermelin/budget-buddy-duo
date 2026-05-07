-- Import rules: auto-categorize transactions when matching description patterns
create table import_rules (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  pattern       text not null,                       -- substring to match (case-insensitive)
  match_type    text not null default 'contains'
                check (match_type in ('contains', 'starts_with', 'exact', 'regex')),
  category_id   uuid references categories(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  priority      int not null default 0,              -- higher = applied first
  created_at    timestamptz not null default now()
);

alter table import_rules enable row level security;

create policy "household full access" on import_rules
  for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index import_rules_household_priority_idx
  on import_rules (household_id, priority desc);

-- BudgetBuddy – savings snapshots
-- Records point-in-time account balances for shared savings goals,
-- so users can manually reconcile against real account balances (e.g. Avanza)
-- and visualise balance development over time.

create table savings_snapshots (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references savings_goals(id) on delete cascade,
  date        date not null default current_date,
  balance     numeric not null check (balance >= 0),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index savings_snapshots_goal_date_idx on savings_snapshots (goal_id, date desc);

alter table savings_snapshots enable row level security;

create policy "household full access" on savings_snapshots for all
  using (exists (select 1 from savings_goals g where g.id = goal_id and is_household_member(g.household_id)))
  with check (exists (select 1 from savings_goals g where g.id = goal_id and is_household_member(g.household_id)));

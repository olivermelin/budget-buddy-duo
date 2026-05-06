-- Add owner support to savings goals
-- owner_id NULL = shared/gemensamt goal
alter table savings_goals
  add column owner_id uuid references auth.users(id) on delete set null;

comment on column savings_goals.owner_id is 'NULL = gemensamt mål, annars person-specifikt';

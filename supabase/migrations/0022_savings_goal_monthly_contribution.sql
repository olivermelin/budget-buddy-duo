-- Månadssparande per sparmål: när satt genereras ett bidrag automatiskt varje månad.
alter table savings_goals
  add column if not exists monthly_contribution numeric default 0;

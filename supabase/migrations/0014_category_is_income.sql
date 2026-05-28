alter table categories
  add column if not exists is_income boolean not null default false;

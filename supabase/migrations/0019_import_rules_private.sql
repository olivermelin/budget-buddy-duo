-- Import-regler kan flagga matchande transaktioner som privata
alter table import_rules
  add column if not exists is_private boolean not null default false;

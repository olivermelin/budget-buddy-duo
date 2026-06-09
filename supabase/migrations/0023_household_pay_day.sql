-- Lönedag: vilken dag i månaden lönen kommer (1 = kalendermånad, 25 = 25:e varje månad).
-- Påverkar hur "månaden" beräknas i budget och statistik.
alter table households
  add column if not exists pay_day integer default 1 check (pay_day between 1 and 28);

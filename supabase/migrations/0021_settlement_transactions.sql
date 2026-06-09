-- Settlement-registrering: möjliggör att registrera betalningar mellan partners
-- Settlement-transaktioner representerar utjämninsbetalningar och ingår inte i
-- framtida split-beräkningar. De har type='settlement' och settlement_receiver_user_id.

alter table transactions
  add column if not exists settlement_receiver_user_id uuid references auth.users(id);

-- Uppdatera type constraint för att inkludera 'settlement'
alter table transactions
  drop constraint if exists transactions_type_check,
  add constraint transactions_type_check
  check (type in ('expense', 'income', 'settlement'));

-- Index för settlement-queries
create index if not exists transactions_settlement_idx
  on transactions(household_id, date)
  where type = 'settlement';

create index if not exists transactions_settlement_receiver_idx
  on transactions(settlement_receiver_user_id)
  where type = 'settlement';

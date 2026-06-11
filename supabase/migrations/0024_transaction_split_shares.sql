-- Per-transaktion-split: anpassad fördelning för enskilda utgifter.
-- jsonb-objekt { "<user_id>": <procent>, ... } som summerar till 100.
-- null = transaktionen delas enligt hushållets standardregler (split_mode).
alter table transactions
  add column if not exists split_shares jsonb;

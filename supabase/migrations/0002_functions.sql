-- Run this in Supabase Dashboard → SQL Editor (after 0001_init.sql)

-- Atomically increment saved amount on a savings goal
create or replace function increment_goal_saved(gid uuid, delta numeric)
returns void language sql security definer as $$
  update savings_goals set saved = saved + delta where id = gid;
$$;

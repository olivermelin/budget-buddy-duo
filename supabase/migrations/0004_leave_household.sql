-- BudgetBuddy – allow members to leave a household
-- Adds DELETE policy on household_members so a user can remove only their own row.

create policy "own row can delete" on household_members
  for delete using (user_id = auth.uid());

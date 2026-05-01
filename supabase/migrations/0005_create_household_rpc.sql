-- BudgetBuddy – atomic household creation
-- Wraps household + member + categories + invite in one transaction.
-- If any step fails, all are rolled back — no orphan households.

create or replace function create_household_with_owner(
  hh_name        text,
  display_name   text,
  invite_code    text,
  member_color   text default '#1e3a5f'
) returns json language plpgsql security definer as $$
declare
  hid uuid := gen_random_uuid();
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(hh_name)) = 0 then
    raise exception 'Household name required';
  end if;

  insert into households (id, name) values (hid, trim(hh_name));

  insert into household_members (household_id, user_id, display_name, role, person_color)
    values (hid, uid, coalesce(nullif(trim(display_name), ''), 'Person 1'), 'owner', member_color);

  perform seed_default_categories(hid);

  insert into household_invites (household_id, invite_code, created_by)
    values (hid, upper(invite_code), uid);

  return json_build_object(
    'household_id', hid,
    'invite_code', upper(invite_code)
  );
end;
$$;

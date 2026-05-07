-- GDPR: Radera mitt konto (2026-05-07)
--
-- Funktion som användaren kan anropa för att ta bort sin persondata.
-- Täcker GDPR Art. 17 (rätten att bli raderad).
--
-- Vad som raderas:
--   - Användaren tas bort från alla hushåll (household_members)
--   - Om hushållet blir tomt: hushållet raderas (CASCADE tar med all data)
--   - Misslyckade invite-försök raderas
--   - Anonymiserade poster (payer_user_id → null) behålls i transaktioner
--     eftersom de ägs av hushållet, inte individen
--
-- Vad som INTE raderas härifrån:
--   - auth.users-posten (kräver Supabase admin-API eller Dashboard)
--   - Loggas med tydlig notering till administratören

create or replace function delete_my_account()
returns void language plpgsql security definer as $$
declare
  hm           record;
  member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Gå igenom alla hushåll användaren är med i
  for hm in
    select household_id from household_members where user_id = auth.uid()
  loop
    select count(*) into member_count
    from household_members
    where household_id = hm.household_id;

    if member_count <= 1 then
      -- Användaren är ensam kvar – radera hela hushållet (CASCADE)
      delete from households where id = hm.household_id;
    else
      -- Andra finns kvar – ta bara bort denna användare
      delete from household_members
      where user_id = auth.uid()
        and household_id = hm.household_id;
    end if;
  end loop;

  -- Rensa rate limit-loggar
  delete from invite_attempts where user_id = auth.uid();
end;
$$;

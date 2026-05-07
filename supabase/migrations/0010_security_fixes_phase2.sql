-- Säkerhetsfix fas 2 (2026-05-07)
--
-- Fynd 2 (HÖG): seed_default_categories saknar auth- och behörighetskontroll.
--   En inloggad angripare kan anropa funktionen med godtyckligt hid och fylla
--   ett främmande hushåll med duplikatkategorier (SECURITY DEFINER kringgår RLS).
--
-- Fynd 6 (LÅG): Ingen explicit deny-policy på households DELETE.
--   Lägger till en tydlig block-policy för att skydda mot framtida misstag.

-- ─── Fynd 2: Auth + membership-kontroll + idempotens ─────────────────────────

create or replace function seed_default_categories(hid uuid)
returns void language plpgsql security definer as $$
begin
  -- Kräv inloggning
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Kräv att anroparen är medlem i hushållet
  if not is_household_member(hid) then
    raise exception 'Access denied';
  end if;

  -- Idempotens: avbryt om kategorier redan finns
  if exists (select 1 from categories where household_id = hid) then
    return;
  end if;

  insert into categories (household_id, name, icon, color, budget_monthly, is_fixed, sort_order) values
    (hid, 'Mat & Hushåll', '🛒', '158 64% 42%', 5000, false, 1),
    (hid, 'Boende',        '🏠', '222 47% 17%', 8000, true,  2),
    (hid, 'Transport',     '🚗', '38 92% 50%',  2000, false, 3),
    (hid, 'Nöje',          '🎬', '271 77% 57%', 1500, false, 4),
    (hid, 'Shopping',      '👕', '340 75% 55%', 2000, false, 5),
    (hid, 'Abonnemang',    '📱', '198 84% 43%',  800, true,  6),
    (hid, 'Resor',         '✈️', '168 70% 38%', 3000, false, 7),
    (hid, 'Övrigt',        '📦', '215 16% 47%', 1000, false, 8);
end;
$$;

-- ─── Fynd 6: Explicit deny-policy på households DELETE ────────────────────────
-- Ingen policy = ingen DELETE (nar RLS ar pa) -- men en explicit policy
-- dokumenterar intentionen och skyddar mot framtida felbetingade tillstand.

drop policy if exists "deny delete" on households;

create policy "deny delete" on households
  for delete using (false);

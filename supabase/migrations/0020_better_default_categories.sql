-- Uppdaterar standardkategorier för nya hushåll med en mer komplett uppsättning.
-- Befintliga hushåll påverkas ej — använd knappen "Standardkategorier" i appen.

create or replace function seed_default_categories(hid uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from household_members where household_id = hid and user_id = auth.uid()
  ) and not exists (
    select 1 from households where id = hid
  ) then
    raise exception 'Ej behörig';
  end if;

  if exists (select 1 from categories where household_id = hid) then
    return;
  end if;

  insert into categories (household_id, name, icon, color, budget_monthly, is_fixed, is_income, sort_order) values
    -- Inkomst
    (hid, 'Lön',                '💰', '142 71% 45%', 0,    false, true,  1),
    (hid, 'Övriga inkomster',   '💵', '152 60% 40%', 0,    false, true,  2),
    -- Fasta utgifter
    (hid, 'Boende',             '🏠', '222 47% 17%', 0,    true,  false, 3),
    (hid, 'Bredband & TV',      '📡', '199 84% 43%', 0,    true,  false, 4),
    (hid, 'Abonnemang',         '📱', '198 84% 43%', 0,    true,  false, 5),
    (hid, 'Försäkringar',       '🛡', '30 80% 50%',  0,    true,  false, 6),
    -- Rörliga utgifter
    (hid, 'Mat & Dagligvaror',  '🛒', '158 64% 42%', 4000, false, false, 7),
    (hid, 'Restaurang & Café',  '🍽', '25 85% 55%',  1500, false, false, 8),
    (hid, 'Transport',          '🚗', '38 92% 50%',  1500, false, false, 9),
    (hid, 'Hälsa & Träning',    '🏃', '172 60% 40%', 600,  false, false, 10),
    (hid, 'Shopping & Kläder',  '👕', '340 75% 55%', 1500, false, false, 11),
    (hid, 'Hem & Inredning',    '🛋', '210 60% 45%', 1000, false, false, 12),
    (hid, 'Nöje & Aktiviteter', '🎬', '271 77% 57%', 1000, false, false, 13),
    (hid, 'Resor & Semester',   '✈',  '168 70% 38%', 3000, false, false, 14),
    (hid, 'Övrigt',             '📦', '215 16% 47%', 500,  false, false, 15);
end;
$$;

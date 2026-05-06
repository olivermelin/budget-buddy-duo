# Sakerhetsrevision -- Budget Buddy Duo

**Datum:** 2026-05-05
**Revisor:** Sakerhetsansvarig (automatiserad granskning)
**Scope:** Supabase-backend, RLS-policies, RPC-funktioner, klientkod

---

## Sammanfattning

Granskningen identifierade **13 fynd** fordelade pa:
- Kritisk: 2
- Hog: 4
- Medel: 5
- Lag: 2

Den allvarligaste bristen ar att RPC-funktionerna `increment_goal_saved` och `seed_default_categories` saknar all autentiserings- och behorighetskontroll, vilket tillater en inloggad angripare att manipulera godtyckliga hushalls data.

---

## Fynd

### 1. increment_goal_saved saknar auth- och behorighetskontroll

- **Sarbarhet:** Funktionen `increment_goal_saved(gid, delta)` ar deklarerad som `SECURITY DEFINER` och kringgaar darmed all RLS. Den kontrollerar varken att anroparen ar inloggad (`auth.uid()`) eller att anroparen ar medlem i det hushall som sparmaalet tillhor. En inloggad angripare kan anropa `supabase.rpc('increment_goal_saved', { gid: '<any-goal-uuid>', delta: 999999 })` och manipulera `saved`-beloppet pa vilket sparmal som helst, inklusive att satta negativa varden (delta kan vara negativt -- ingen check finns).
- **Allvarlighetsgrad:** Kritisk
- **Fil/rad:** `supabase/migrations/0002_functions.sql`, rad 4-7
- **Atgardsforslag:**
  ```sql
  create or replace function increment_goal_saved(gid uuid, delta numeric)
  returns void language plpgsql security definer as $$
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;
    if not exists (
      select 1 from savings_goals g
      where g.id = gid
        and is_household_member(g.household_id)
    ) then
      raise exception 'Access denied';
    end if;
    if delta <= 0 then
      raise exception 'Delta must be positive';
    end if;
    update savings_goals set saved = saved + delta where id = gid;
  end;
  $$;
  ```

---

### 2. seed_default_categories saknar auth- och behorighetskontroll

- **Sarbarhet:** Funktionen `seed_default_categories(hid)` ar `SECURITY DEFINER` och kontrollerar varken autentisering eller att anroparen ar medlem i hushallet. En inloggad angripare kan anropa den med godtyckligt `hid` och fylla frammande hushall med duplicerade standardkategorier. Funktionen har inte heller nagon idempotens-kontroll, sa upprepade anrop skapar dubbletter.
- **Allvarlighetsgrad:** Hog
- **Fil/rad:** `supabase/migrations/0001_init.sql`, rad 133-146
- **Atgardsforslag:**
  ```sql
  create or replace function seed_default_categories(hid uuid)
  returns void language plpgsql security definer as $$
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;
    if not is_household_member(hid) then
      raise exception 'Access denied';
    end if;
    -- Idempotens: avbryt om kategorier redan finns
    if exists (select 1 from categories where household_id = hid) then
      return;
    end if;
    insert into categories (...) values ...;
  end;
  $$;
  ```

---

### 3. join_household saknar rate limiting -- brute force av inbjudningskoder

- **Sarbarhet:** Inbjudningskoder genereras som 6 tecken fran `crypto.getRandomValues(new Uint8Array(4))` mappade via `toString(36).toUpperCase().slice(0, 6)`. Det ger ett begransat utrymme av alfanumeriska tecken (0-9, A-Z), dvs. cirka 36^6 = ~2,2 miljarder kombinationer. Funktionen `join_household(code)` ar `SECURITY DEFINER` och har ingen rate limiting eller lockout. En angripare med ett giltigt JWT kan brute-forca koder programmatiskt. Dessutom uppdateras koden till `used_by` vid forsta anvandning, men det finns ingen begransning pa antal inbjudningskoder per hushall eller per anvandare.
- **Allvarlighetsgrad:** Hog
- **Fil/rad:** `supabase/migrations/0001_init.sql`, rad 149-176 (join_household); `src/pages/Onboarding.tsx`, rad 31-34 (kodgenerering)
- **Atgardsforslag:**
  1. Implementera rate limiting pa Supabase Edge Functions eller via en pg-tabell som loggar misslyckade forsok.
  2. Overvag langre inbjudningskoder (8-12 tecken).
  3. Begransad livstid (redan 7 dagar -- bra) men lagg till max antal misslyckade forsok per IP/user.
  4. Lagg till `FOR UPDATE SKIP LOCKED` i invite-queryn for att motverka race conditions.

---

### 4. household_members INSERT-policy tillater att lagga till sig sjalv i godtyckligt hushall

- **Sarbarhet:** INSERT-policyn pa `household_members` ar `with check (auth.uid() is not null)`. Det enda kravet ar att anvandaren ar inloggad. En angripare kan darfor gora `supabase.from('household_members').insert({ household_id: '<target-hh-id>', user_id: auth.uid(), display_name: 'Hacker', role: 'member' })` och lagga till sig sjalv i vilket hushall som helst -- utan inbjudningskod. Detta ar en kritisk brist som helt kringgaar inbjudningssystemet.
- **Allvarlighetsgrad:** Kritisk
- **Fil/rad:** `supabase/migrations/0001_init.sql`, rad 113
- **Atgardsforslag:** Andras till en restriktiv policy, t.ex.:
  ```sql
  -- Ta bort nuvarande INSERT-policy och ersatt med:
  create policy "only via rpc" on household_members
    for insert with check (false);
  ```
  All member-insertion ska ske via `create_household_with_owner` och `join_household` som ar `SECURITY DEFINER` och darmed kringgaar RLS. Alternativt, om direkt INSERT behover finnas, krav pa att anroparen redan ar owner:
  ```sql
  create policy "owner can add members" on household_members
    for insert with check (
      exists (
        select 1 from household_members
        where household_id = new.household_id
          and user_id = auth.uid()
          and role = 'owner'
      )
    );
  ```

---

### 5. Privilege escalation -- member kan gora sig till owner

- **Sarbarhet:** UPDATE-policyn pa `household_members` ar `using (user_id = auth.uid())` utan nagon `WITH CHECK`-begransning pa vilka kolumner som far andras. En anvandare kan uppdatera sin egen rad och satta `role = 'owner'`:
  ```ts
  supabase.from('household_members').update({ role: 'owner' }).eq('user_id', userId).eq('household_id', hhId)
  ```
  Aven om `role`-kolumnen har en CHECK-constraint (`role in ('owner', 'member')`) sa forhindrar inte policyn att `member` andras till `owner`.
- **Allvarlighetsgrad:** Hog
- **Fil/rad:** `supabase/migrations/0001_init.sql`, rad 114
- **Atgardsforslag:** Lagg till `WITH CHECK` som forbjuder role-andring, eller exkludera `role` fran vad som kan uppdateras:
  ```sql
  create policy "own row can update" on household_members
    for update using (user_id = auth.uid())
    with check (user_id = auth.uid() and role = 'member');
  ```
  Alternativt, anvand en trigger som forhindrar role-forandringar:
  ```sql
  create or replace function prevent_role_change()
  returns trigger as $$
  begin
    if NEW.role != OLD.role then
      raise exception 'Role cannot be changed';
    end if;
    return NEW;
  end;
  $$ language plpgsql;
  ```

---

### 6. Ingen DELETE-policy pa households -- men ingen behovs (saknar dock skydd)

- **Sarbarhet:** Det finns ingen explicit DELETE-policy pa tabellen `households`. Nar RLS ar aktiverat utan DELETE-policy innebar det att ingen (inklusive owners) kan ta bort hushall direkt. Detta ar bra som standard-skydd, men det saknas en explicit `deny`-policy. Om nagon av misstag lagger till en permissive DELETE-policy i framtiden kan det leda till dataforlust via CASCADE (alla child-tabeller har `ON DELETE CASCADE`).
- **Allvarlighetsgrad:** Lag
- **Fil/rad:** `supabase/migrations/0001_init.sql`, rad 107-109
- **Atgardsforslag:** Lagg till en explicit deny-policy for sakerhet:
  ```sql
  -- Explicit: ingen DELETE pa households via API
  -- (hanteras via admin/dashboard om det behovs)
  ```
  Och dokumentera att household-borttagning enbart ska ske via service_role.

---

### 7. Saknad serverside-validering i klientkod -- IDOR via UUID-manipulation

- **Sarbarhet:** Klienten skickar UUID:er direkt i alla operationer (t.ex. `action.id`, `action.goalId`, `action.snapshotId`). I `writeToSupabase` anropas t.ex. `supabase.from("transactions").update(patch).eq("id", action.id)` utan att filtrera pa `household_id`. RLS-policies skyddar aven har, men:
  - `UPDATE_TX` och `DELETE_TX` filtrerar enbart pa `id`, inte pa `household_id`. RLS-policyn USING-klausulen kraver `is_household_member(household_id)`, sa Supabase matchar raden forst och validerar sedan RLS. Det ar korrekt beteende.
  - `DELETE_GOAL_SNAPSHOT` filtrerar pa `eq("id", action.snapshotId)` utan household_id -- RLS skyddar aven har via subquery till savings_goals.
  - **Huvudrisken:** Om en RLS-policy nagonsin felanvands eller tas bort exponeras alla rader. Defence-in-depth saknas.
- **Allvarlighetsgrad:** Medel
- **Fil/rad:** `src/store/budget-store.tsx`, rad 220, 224, 280
- **Atgardsforslag:** Lagg till `household_id`-filter i alla write-operationer som defence-in-depth:
  ```ts
  await supabase.from("transactions").update(patch).eq("id", action.id).eq("household_id", householdId);
  await supabase.from("transactions").delete().eq("id", action.id).eq("household_id", householdId);
  ```

---

### 8. Realtime-kanalnamn ar forutsagbara -- informationslackage

- **Sarbarhet:** Realtime-kanaler prenumererar med filtret `household_id=eq.${householdId}`. Kanalnamnet ar `hh-${householdId}`. Aven om Supabase Realtime respekterar RLS (nar RLS ar konfigurerat for Realtime), sa ar det mojligt for en angripare att forsoka prenumerera pa en annan hushallskanal. Om Realtime-RLS inte ar aktiverat i Supabase Dashboard (det ar en separat installning fran tabell-RLS) kan detta leda till att en angripare ser alla INSERT/UPDATE/DELETE-events for frammande hushall.
- **Allvarlighetsgrad:** Medel
- **Fil/rad:** `src/store/budget-store.tsx`, rad 287-295
- **Atgardsforslag:**
  1. Verifiera att Realtime RLS-policies ar aktiverade i Supabase Dashboard (Database > Replication > kontrollera "RLS" ar pa for varje tabell).
  2. Overvag att anvanda Supabase Broadcast med auth-tokens istallet for databaskanaler.

---

### 9. .env-filen saknas i .gitignore

- **Sarbarhet:** `.gitignore` inkluderar INTE `.env`-filer explicit. Enbart `*.local` matchas. Om en utvecklare skapar en `.env`-fil (utan `.local`-suffix) och comittar den riskeras att anon-nyckeln och Supabase-URL:en exponeras i Git-historiken. `.env.example` finns korrekt med platshallare.
- **Allvarlighetsgrad:** Medel
- **Fil/rad:** `.gitignore` (saknar `.env`-rad)
- **Atgardsforslag:** Lagg till i `.gitignore`:
  ```
  .env
  .env.*
  !.env.example
  ```

---

### 10. localStorage for household-val -- client-side trust

- **Sarbarhet:** Det aktiva hushallet lagras i `localStorage` (`budgetbuddy.activeHouseholdId`). En angripare kan manuellt andra detta varde till ett annat households UUID. Dock valideras detta pa serversidan via RLS vid varje datahamtning, sa angriparen far tomt resultat om de inte ar medlem. `fetchHouseholds` validerar aven att det sparade ID:t finns i listan over hushall anvandaren tillhor (rad 62). Risken ar darfor lag men `switchHousehold` (rad 94-96) accepterar godtyckligt ID utan validering mot `households`-listan.
- **Allvarlighetsgrad:** Lag
- **Fil/rad:** `src/context/AuthContext.tsx`, rad 34-38 (persistActive), rad 94-96 (switchHousehold)
- **Atgardsforslag:** Validera i `switchHousehold` att det valda ID:t finns i `households`-listan:
  ```ts
  const switchHousehold = useCallback((id: string) => {
    if (!households.some(h => h.id === id)) return;
    setHouseholdIdState(id);
    persistActive(id);
  }, [households, persistActive]);
  ```

---

### 11. Inbjudningskoder ar engangskoder men det saknas begransning pa antal koder per hushall

- **Sarbarhet:** Varje inbjudningskod markeras med `used_by` nar den anvands, vilket gor den till en engangskod. Men det finns ingen begransning pa hur manga inbjudningskoder en medlem kan generera (varje klick pa "Bjud in" i `Settings.tsx` skapar en ny). En illasinnad medlem kan skapa hundratals koder. Dessutom gor `join_household`-funktionen `ON CONFLICT DO NOTHING` vid insert av ny medlem, vilket innebar att redan-medlemmar tyst kan "forbruka" andras koder.
- **Allvarlighetsgrad:** Medel
- **Fil/rad:** `src/pages/Settings.tsx`, rad 194-213 (generateInvite); `supabase/migrations/0001_init.sql`, rad 168 (ON CONFLICT DO NOTHING)
- **Atgardsforslag:**
  1. Begransning: max N aktiva (oanvanda, ej utgangna) koder per hushall. T.ex. via en CHECK eller trigger.
  2. Overvag att ateranvanda befintlig aktiv kod istallet for att alltid generera en ny.

---

### 12. UPDATE_PERSON tillater andring av andra medlemmars profil inom samma hushall

- **Sarbarhet:** RLS-policyn for UPDATE pa `household_members` ar `using (user_id = auth.uid())`, vilket korrekt begransar till den egna raden. MEN klientkoden i `writeToSupabase` anvaander `.eq("user_id", action.id)` dar `action.id` ar den uppdaterade personens ID (som kan vara en annan anvandare). RLS-policyn pa servern skyddar mot detta (bara `user_id = auth.uid()` passerar), men klientkoden forsaker uppdatera andra anvandares rader. Det innebar att UI:t visuellt later en anvandare redigera en annan persons namn/inkomst/farg i frontenden, men backend-anropet ignoreras tyst (0 rader paverkas) eftersom RLS blockerar det.
- **Allvarlighetsgrad:** Medel
- **Fil/rad:** `src/store/budget-store.tsx`, rad 241-245; `src/pages/Settings.tsx`, rad 253-259
- **Atgardsforslag:** Filtrera i UI:t sa att enbart den egna anvandaren kan redigeras, eller visa tydligt att andras falt ar readonly:
  ```tsx
  const isMe = p.id === user?.id;
  // Gora falt disabled om !isMe
  ```

---

### 13. Saknad Content Security Policy och sakerhetsheaders

- **Sarbarhet:** Ingen Content Security Policy (CSP), X-Frame-Options, X-Content-Type-Options eller andra sakerhetsheaders har konfigurerats. Detta gor appen saarbar for XSS via tredjepartsscript, clickjacking (inbaddning i iframe pa ondskefulla sidor) och MIME-sniffing-attacker.
- **Allvarlighetsgrad:** Hog
- **Fil/rad:** Ingen konfigurationsfil for headers hittades (t.ex. `vercel.json`, `netlify.toml`, eller `vite.config.ts` headers).
- **Atgardsforslag:** Lagg till sakerhetsheaders i hosting-konfigurationen. Exempelvis for Vercel (`vercel.json`):
  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data:; font-src 'self';" }
        ]
      }
    ]
  }
  ```

---

## Riskmatris

| # | Fynd | Allvarlighetsgrad | Paverkan |
|---|-------|-------------------|----------|
| 1 | increment_goal_saved saknar auth-kontroll | Kritisk | Datamanipulation i alla hushall |
| 2 | seed_default_categories saknar auth-kontroll | Hog | Skrapdata i frammande hushall |
| 3 | Brute force av inbjudningskoder | Hog | Obehörig atkomst till hushall |
| 4 | household_members INSERT utan begransning | Kritisk | Kringgaar hela inbjudningssystemet |
| 5 | Privilege escalation member -> owner | Hog | Full kontroll over hushall |
| 6 | Ingen DELETE-policy pa households | Lag | Framtidsrisk vid policyandring |
| 7 | IDOR -- saknad defence-in-depth i klient | Medel | Beroende av RLS-korrekthet |
| 8 | Realtime-kanal informationslackage | Medel | Potentiell dataexponering |
| 9 | .env saknas i .gitignore | Medel | Laekage av anon-nyckel |
| 10 | localStorage household-val | Lag | Minimal risk, RLS skyddar |
| 11 | Obegransat antal inbjudningskoder | Medel | Spam/missbruk |
| 12 | UI tillater redigering av andras profil | Medel | Forvirrande UX, tyst fel |
| 13 | Saknade sakerhetsheaders (CSP etc.) | Hog | XSS, clickjacking |

---

## Prioriterad atgardsplan

### Omedelbart (blockerande fore produktion)
1. **Fynd 4:** Lasa INSERT-policyn pa `household_members` till `with check (false)` -- all insertion via RPC.
2. **Fynd 1:** Lagg till auth + membership-kontroll i `increment_goal_saved`.
3. **Fynd 5:** Forhindra role-andring i `household_members` UPDATE-policy.

### Hog prioritet (inom 1 sprint)
4. **Fynd 2:** Lagg till auth + membership-kontroll i `seed_default_categories`.
5. **Fynd 3:** Implementera rate limiting pa `join_household`.
6. **Fynd 13:** Konfigurera CSP och sakerhetsheaders.
7. **Fynd 9:** Lagg till `.env` i `.gitignore`.

### Medel prioritet (planera in)
8. **Fynd 7:** Lagg till `household_id`-filter i alla write-operationer.
9. **Fynd 8:** Verifiera Realtime RLS i Supabase Dashboard.
10. **Fynd 11:** Begransat antal aktiva inbjudningskoder.
11. **Fynd 12:** Gor andras profiler readonly i UI.

### Lag prioritet
12. **Fynd 6:** Dokumentera household-borttagning.
13. **Fynd 10:** Validera householdId i switchHousehold.

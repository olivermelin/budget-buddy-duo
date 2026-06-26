# Konkreta åtgärdsförslag för hög skuldbörda

**Datum:** 2026-06-26
**Yta:** Ekonomisk hälsa (`/financial-health`)

## Problem

`debt-service`-fyndet ("Hög skuldbörda") i `src/lib/financial-health.ts` konstaterar
problemet men är det enda fyndet utan ett `action`/förslag. Användaren vill att appen
föreslår konkreta sätt att förbättra skuldbördan — t.ex. amortera mer eller göra en
engångsinsättning — med riktiga siffror.

## Princip (oförändrad arkitektur)

Regelmotorn (`computeFinancialHealth`) äger **alla** siffror. AI-lagret
(edge function `financial-health-advice`) formulerar bara text och får aldrig hitta på
belopp. Alla nya tal beräknas deterministiskt i regelmotorn.

## Lösning

### 1. Ren hjälpfunktion — amorteringssimulering

I `financial-health.ts` (ingen ny fil):

```
simulatePayoff(balance, annualRatePct, monthlyPrincipal) → { months, totalInterest }
```

Simulerar månad för månad: ränta ackumuleras på saldot, fast amortering minskar saldot,
stopp vid 0. Capas vid 1200 månader (100 år) så ett lån med 0 i amortering inte loopar
oändligt (returnerar då `months: Infinity`). Modellen följer appens fasta amortering
(`monthlyAmortization`); annuitetslån betalas av något snabbare — det är en medvetet
försiktig (konservativ) uppskattning. Kommenteras i koden.

### 2. `HealthFinding` får `scenarios?`

```ts
scenarios?: { label: string; detail: string; impact?: number }[]
```

Upp till tre scenarier beräknas och hängs på `debt-service`-fyndet när status är
`warn`/`bad`. Alla förankras i det **dyraste lånet** (högst ränta med saldo > 0;
fallback: störst saldo).

**Underlag:**
- `freeCashFlow = max(0, income − fixed − variable − debtMonthly)` — överskott *efter*
  nuvarande lånekostnader. Konservativt: om lånebetalningar råkar vara kategoriserade
  blir talet bara mindre, aldrig större.
- `excessBuffer = max(0, totalSaved − expenses*3)` — sparande över trygghetsbufferten.

**Scenario A — Extra amortering** (visas bara om `freeCashFlow ≥ 300`):
- `extra = round500(freeCashFlow * 0.2)` — en blygsam startpunkt (en femtedel av
  överskottet), så att merparten finns kvar att leva och spara för. Användaren finjusterar
  sedan i simulatorn. (Halva överskottet visade sig kännas orimligt högt i praktiken.)
- Jämför `simulatePayoff(B, r, amort)` mot `simulatePayoff(B, r, amort + extra)`.
- Text: "Amortera **{extra}/mån** extra på {lån}: skuldfri **{Δmån}** mån tidigare,
  spara **{Δränta}** i ränta." (`impact = Δränta/livslängd per mån`)
- Kräver `monthlyAmortization > 0` och ändlig baslivslängd.
- `sim: { loanId, extra }` — djuplänk som förifyller amorteringssimulatorn.

**Scenario B — Engångsinsättning:**
- Om `excessBuffer ≥ 5000`: `lump = round1000(excessBuffer)`, text refererar
  "buffert över 3 mån".
- Annars: opportunistiskt exempel `lump = round1000(income)`, text "vid en bonus eller
  skatteåterbäring på t.ex. …" — föreslår aldrig att tömma bufferten.
- Effekt: jämför `simulatePayoff(B, …)` mot `simulatePayoff(B − lump, …)` →
  kortare löptid + sparad ränta.

**Scenario C — Sänk skuldkvoten** (den ärliga spaken för själva kvoten):
- `gap = debtMonthly − income*0.20`.
- Pekar ut minsta lånet (lägst total månadskostnad) att lösa/refinansiera.
- Text: "Lånekostnaderna ligger **{gap}/mån** över riktmärket 20 %. Att lösa {minsta
  lån} ({kostnad}/mån) tar er närmare." (`impact = gap`)

**Ärlighet:** A och B sänker *räntekostnad* och *löptid* men höjer månadsutflödet på
kort sikt — de sänker alltså inte skuldkvoten. Endast C (lösa/refinansiera ett lån)
sänker kvoten. Varje scenariotext beskriver det det faktiskt åstadkommer; de buntas
inte ihop som om de vore samma sak.

### 3. UI

Scenarierna renderas som en liten lista inuti det befintliga `debt-service`-kortet i
`FinancialHealth.tsx` (`FindingRow` → `ScenarioRow`). Ingen ny korttyp; statusfärgmodellen
rörs inte.

Varje scenario med `sim`-data är en klickbar `Link` ("Simulera ›") till
`/loans?tab=simulator&loanId=…&extra=…&lump=…`. `Loans.tsx` läser query-paramen, byter till
Simulera-fliken och skickar `initialLoanId/initialExtra/initialLump` till
`ExtraAmortizationSimulator`, som förifyller reglaget och engångsfältet (extrabeloppet
klampas till reglagets 0–20 000 kr). Så blir förslaget en startpunkt användaren själv kan
justera vidare.

### 4. AI-sammanfattning

`scenarios`-texterna skickas med i payloaden till `financial-health-advice` så att
AI-sammanfattningen kan referera de konkreta talen (motorn räknar, AI formulerar).
Fallback-texten påverkas inte negativt.

### 5. Tester

- Enhetstest för `simulatePayoff`: korrekt löptid/ränta för enkelt fall; `Infinity` vid
  0 amortering; extra amortering ger kortare löptid och lägre ränta.
- Test för att `debt-service`-fyndet får scenarier med rätt tecken (extra > 0 → Δmån > 0,
  Δränta > 0) när överskott finns, och att scenario A utelämnas utan överskott.

## Avgränsningar (YAGNI)

- Ingen interaktiv reglage-UI (användaren valde statiska förslag).
- Ingen ändring av poängberäkningen eller vikterna.
- Ingen refaktorering utanför skuldområdet.

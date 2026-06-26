import { useMemo, useState } from "react";
import { currentPeriodMonth } from "@/lib/analytics";

/**
 * Delad månadsnavigering: `offset` 0 = innevarande period, negativa värden bakåt.
 * `canGoNext` blockerar framtiden (appen visar aldrig kommande perioder).
 * `monthDate` är den 1:a i vald månad och har stabil referens per offset så att
 * den kan användas direkt i useMemo-beroenden.
 *
 * `payDay` gör navigeringen lönedagsmedveten: en löneperiod märkt "månad M" löper
 * från lönedag i M-1 t.o.m. lönedag-1 i M (se `inMonth` i analytics.ts). När dagens
 * datum nått lönedagen tillhör "nu" alltså redan *nästa* periods etikett, så offset 0
 * skiftas en månad framåt — annars visas en redan avslutad period och utgifter som
 * registrerats efter lönedagen blir både osynliga och onåbara (canGoNext blockerar dem).
 * payDay <= 1 = ren kalendermånad (inget skift).
 */
export function useMonthNavigator(payDay = 1) {
  const [offset, setOffset] = useState(0);
  const monthDate = useMemo(() => {
    const base = currentPeriodMonth(payDay);
    return new Date(base.getFullYear(), base.getMonth() + offset, 1);
  }, [offset, payDay]);

  return {
    offset,
    monthDate,
    prev: () => setOffset((o) => o - 1),
    next: () => setOffset((o) => o + 1),
    canGoNext: offset < 0,
  };
}

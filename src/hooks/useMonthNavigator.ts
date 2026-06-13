import { useMemo, useState } from "react";

/**
 * Delad månadsnavigering: `offset` 0 = innevarande månad, negativa värden bakåt.
 * `canGoNext` blockerar framtiden (appen visar aldrig kommande månader).
 * `monthDate` är den 1:a i vald månad och har stabil referens per offset så att
 * den kan användas direkt i useMemo-beroenden.
 */
export function useMonthNavigator() {
  const [offset, setOffset] = useState(0);
  const monthDate = useMemo(() => {
    const ref = new Date();
    return new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  }, [offset]);

  return {
    offset,
    monthDate,
    prev: () => setOffset((o) => o - 1),
    next: () => setOffset((o) => o + 1),
    canGoNext: offset < 0,
  };
}

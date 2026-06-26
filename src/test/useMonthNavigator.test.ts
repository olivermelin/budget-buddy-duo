import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMonthNavigator } from "@/hooks/useMonthNavigator";

describe("useMonthNavigator", () => {
  it("startar på innevarande månad med offset 0", () => {
    const { result } = renderHook(() => useMonthNavigator());
    const now = new Date();
    expect(result.current.offset).toBe(0);
    expect(result.current.monthDate.getFullYear()).toBe(now.getFullYear());
    expect(result.current.monthDate.getMonth()).toBe(now.getMonth());
    expect(result.current.monthDate.getDate()).toBe(1);
  });

  it("prev() går ett steg bakåt och next() ett steg framåt", () => {
    const { result } = renderHook(() => useMonthNavigator());
    act(() => result.current.prev());
    expect(result.current.offset).toBe(-1);
    const back = new Date();
    back.setDate(1);
    back.setMonth(back.getMonth() - 1);
    expect(result.current.monthDate.getFullYear()).toBe(back.getFullYear());
    expect(result.current.monthDate.getMonth()).toBe(back.getMonth());

    act(() => result.current.next());
    expect(result.current.offset).toBe(0);
  });

  it("canGoNext blockerar framtid: falskt på nuvarande månad, sant i historiken", () => {
    const { result } = renderHook(() => useMonthNavigator());
    expect(result.current.canGoNext).toBe(false);
    act(() => result.current.prev());
    expect(result.current.canGoNext).toBe(true);
    act(() => result.current.next());
    expect(result.current.canGoNext).toBe(false);
  });

  it("ger en stabil monthDate-referens mellan omrenderingar med samma offset", () => {
    const { result, rerender } = renderHook(() => useMonthNavigator());
    const first = result.current.monthDate;
    rerender();
    expect(result.current.monthDate).toBe(first);
  });

  describe("lönedagsmedvetenhet (payDay > 1)", () => {
    afterEach(() => vi.useRealTimers());

    it("efter lönedagen tillhör 'nu' nästa periods etikett (offset 0 = nästa kalendermånad)", () => {
      // 26 juni, lönedag 25 → aktuell löneperiod = 25 jun–24 jul, märkt 'juli'
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 26));
      const { result } = renderHook(() => useMonthNavigator(25));
      expect(result.current.offset).toBe(0);
      expect(result.current.monthDate.getFullYear()).toBe(2026);
      expect(result.current.monthDate.getMonth()).toBe(6); // juli
      expect(result.current.canGoNext).toBe(false);
    });

    it("före lönedagen tillhör 'nu' innevarande kalendermånads etikett", () => {
      // 10 juni, lönedag 25 → aktuell löneperiod = 25 maj–24 jun, märkt 'juni'
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 10));
      const { result } = renderHook(() => useMonthNavigator(25));
      expect(result.current.monthDate.getMonth()).toBe(5); // juni
    });

    it("på lönedagen räknas dagen som starten på den nya perioden", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 25));
      const { result } = renderHook(() => useMonthNavigator(25));
      expect(result.current.monthDate.getMonth()).toBe(6); // juli
    });

    it("payDay = 1 (eller utelämnat) skiftar aldrig — ren kalendermånad", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 26));
      const { result } = renderHook(() => useMonthNavigator(1));
      expect(result.current.monthDate.getMonth()).toBe(5); // juni
    });
  });
});

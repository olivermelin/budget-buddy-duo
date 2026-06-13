import { describe, it, expect } from "vitest";
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
});

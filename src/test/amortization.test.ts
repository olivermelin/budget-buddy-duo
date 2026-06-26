import { describe, it, expect } from "vitest";
import {
  taxDeductionFactor,
  effectiveAnnualRate,
  borrowersForLoan,
} from "@/lib/amortization";

describe("taxDeductionFactor", () => {
  it("är 0 utan räntekostnad", () => {
    expect(taxDeductionFactor(0)).toBe(0);
    expect(taxDeductionFactor(-100)).toBe(0);
  });

  it("ger full 30 % under tröskeln", () => {
    expect(taxDeductionFactor(50_000)).toBeCloseTo(0.3, 10);
    expect(taxDeductionFactor(100_000)).toBeCloseTo(0.3, 10);
  });

  it("blandar ner mot 21 % över tröskeln", () => {
    // 200 000 kr ränta: 100 000 × 30 % + 100 000 × 21 % = 51 000 / 200 000 = 25,5 %.
    expect(taxDeductionFactor(200_000)).toBeCloseTo(0.255, 10);
  });

  it("dubblar tröskeln för två låntagare (par-lån)", () => {
    // 200 000 kr ränta delat på två låntagare ligger på den gemensamma 200k-tröskeln → full 30 %.
    expect(taxDeductionFactor(200_000, 2)).toBeCloseTo(0.3, 10);
    // Med en enda låntagare ska samma ränta blandas ner.
    expect(taxDeductionFactor(200_000, 1)).toBeLessThan(0.3);
  });
});

describe("effectiveAnnualRate", () => {
  it("returnerar nominell ränta utan avdrag", () => {
    expect(effectiveAnnualRate(1_000_000, 3, false)).toBe(3);
  });

  it("sänker räntan med avdragsfaktorn", () => {
    // 1 Mkr × 3 % = 30 000 kr ränta < tröskeln → 30 % avdrag → 3 % × 0,7 = 2,1 %.
    expect(effectiveAnnualRate(1_000_000, 3, true)).toBeCloseTo(2.1, 10);
  });

  it("ger högre effektiv ränta för en ensam låntagare än för ett par vid hög ränta", () => {
    // 5 Mkr × 5 % = 250 000 kr ränta: ensam låntagare blandas ner mot 21 %, paret får mer avdrag.
    const single = effectiveAnnualRate(5_000_000, 5, true, 1);
    const couple = effectiveAnnualRate(5_000_000, 5, true, 2);
    expect(couple).toBeLessThan(single);
  });
});

describe("borrowersForLoan", () => {
  it("räknar gemensamt lån (utan ägare) som alla vuxna", () => {
    expect(borrowersForLoan(null, 2)).toBe(2);
    expect(borrowersForLoan(undefined, 2)).toBe(2);
  });

  it("räknar personligt lån som en låntagare", () => {
    expect(borrowersForLoan("user-1", 2)).toBe(1);
  });

  it("aldrig under en låntagare", () => {
    expect(borrowersForLoan(null, 0)).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import { sek, pct, monthLabel, monthShort, dateLabel, monthKey } from "@/lib/format";

describe("sek", () => {
  it("formaterar positivt heltal till SEK", () => {
    const result = sek(1500);
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result).toMatch(/kr/);
  });

  it("avrundar till heltal som standard", () => {
    const result = sek(99.7);
    expect(result).toContain("100");
  });

  it("visar negativt belopp med minustecken", () => {
    const result = sek(-250);
    expect(result).toContain("250");
    expect(result).toMatch(/−/);
  });

  it("visar plustecken med signed-flagga för positivt belopp", () => {
    const result = sek(500, { signed: true });
    expect(result).toMatch(/\+/);
  });

  it("visar minustecken med signed-flagga för negativt belopp", () => {
    const result = sek(-500, { signed: true });
    expect(result).toMatch(/−/);
  });

  it("formaterar noll korrekt", () => {
    const result = sek(0);
    expect(result).toContain("0");
  });
});

describe("pct", () => {
  it("formaterar decimaltal till procent", () => {
    const result = pct(0.5);
    expect(result).toContain("50");
    expect(result).toMatch(/%/);
  });

  it("formaterar 1.0 till 100%", () => {
    const result = pct(1);
    expect(result).toContain("100");
  });

  it("respekterar antal decimaler", () => {
    const result = pct(0.3333, 1);
    expect(result).toContain("33,3");
  });
});

describe("monthLabel", () => {
  it("returnerar månad och år på svenska", () => {
    const result = monthLabel(new Date(2026, 4, 15)); // maj 2026
    expect(result.toLowerCase()).toContain("maj");
    expect(result).toContain("2026");
  });
});

describe("monthShort", () => {
  it("returnerar kort månadsnamn utan punkt", () => {
    const result = monthShort(new Date(2026, 0, 15)); // januari
    expect(result).not.toContain(".");
    expect(result.length).toBeLessThanOrEqual(4);
  });
});

describe("dateLabel", () => {
  it("returnerar dag och kort månad", () => {
    const result = dateLabel("2026-05-15");
    expect(result).toContain("15");
    expect(result.toLowerCase()).toContain("maj");
  });
});

describe("monthKey", () => {
  it("returnerar YYYY-MM format från Date", () => {
    expect(monthKey(new Date(2026, 4, 15))).toBe("2026-05");
  });

  it("returnerar YYYY-MM format från ISO-sträng", () => {
    expect(monthKey("2026-01-15")).toBe("2026-01");
  });

  it("paddar ensiffrig månad med nolla", () => {
    expect(monthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("hanterar december korrekt", () => {
    expect(monthKey(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "./format";

describe("formatDate", () => {
  const d = new Date(2026, 4, 10); // May 10, 2026 (local)

  it("short", () => expect(formatDate(d, "short")).toBe("May 10, 2026"));
  it("long", () => expect(formatDate(d, "long")).toBe("Sunday, May 10, 2026"));
  it("iso", () => expect(formatDate(d, "iso")).toBe("2026-05-10"));
  it("defaults to short", () => expect(formatDate(d)).toBe("May 10, 2026"));
  it("relative is suffixed", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatDate(twoHoursAgo, "relative")).toMatch(/ago$/);
  });
  it("empty string for invalid input", () =>
    expect(formatDate("not-a-date", "short")).toBe(""));
  it("treats a date-only string as a local calendar day (no UTC off-by-one)", () => {
    // "2026-06-15" must render as Jun 15 regardless of the runner's timezone —
    // not Jun 14 as a naive new Date(iso) UTC parse would in negative offsets.
    expect(formatDate("2026-06-15", "short")).toBe("Jun 15, 2026");
    expect(formatDate("2026-06-15", "iso")).toBe("2026-06-15");
  });
});

describe("formatCurrency", () => {
  it("$0 renders as $0 (F-021)", () => expect(formatCurrency(0)).toBe("$0"));
  it("symbol on the left (F-101)", () =>
    expect(formatCurrency(123456700)).toBe("$1,234,567"));
  it("thousands separators", () =>
    expect(formatCurrency(25000000)).toBe("$250,000"));
  it("negative keeps symbol on left", () =>
    expect(formatCurrency(-50000)).toBe("-$500"));
  it("compact millions", () =>
    expect(formatCurrency(123456700, { compact: true })).toBe("$1.2M"));
  it("compact thousands", () =>
    expect(formatCurrency(25000000, { compact: true })).toBe("$250K"));
  it("compact drops trailing .0", () =>
    expect(formatCurrency(100000000, { compact: true })).toBe("$1M"));
  it("compact zero is $0", () =>
    expect(formatCurrency(0, { compact: true })).toBe("$0"));
  it("compact negative millions", () =>
    expect(formatCurrency(-123456700, { compact: true })).toBe("-$1.2M"));
});

describe("formatPercent", () => {
  it("integer by default (F-118)", () =>
    expect(formatPercent(42.7)).toBe("43%"));
  it("zero", () => expect(formatPercent(0)).toBe("0%"));
  it("with fraction digits", () =>
    expect(formatPercent(42.75, 1)).toBe("42.8%"));
  it("non-finite falls back to 0%", () =>
    expect(formatPercent(NaN)).toBe("0%"));
});

describe("formatNumber", () => {
  it("thousands separators", () =>
    expect(formatNumber(1234567)).toBe("1,234,567"));
  it("negative", () => expect(formatNumber(-1000)).toBe("-1,000"));
  it("zero", () => expect(formatNumber(0)).toBe("0"));
});

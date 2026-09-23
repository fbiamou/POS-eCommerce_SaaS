import { describe, expect, it } from "vitest";
import { dayRangeInTimeZone, formatDate, formatMoney, formatNumber } from "./format";

// Intl uses U+202F (narrow no-break space) to group French thousands and
// U+00A0 before the currency symbol: normalize both to read the assertions.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatNumber", () => {
  it("groups thousands according to the interface language", () => {
    expect(plain(formatNumber(84500, "fr"))).toBe("84 500");
    expect(formatNumber(84500, "en")).toBe("84,500");
    expect(formatNumber(84500, "es")).toBe("84.500");
  });

  it("groups four-digit amounts in Spanish too", () => {
    expect(formatNumber(7900, "es")).toBe("7.900");
  });

  it("never shows decimals", () => {
    expect(formatNumber(1999.6, "fr")).toBe("2" + " " + "000");
  });
});

describe("formatMoney", () => {
  it("uses the shop's own currency symbol", () => {
    expect(plain(formatMoney(3000, "FCFA", "fr"))).toBe("3 000 FCFA");
    expect(plain(formatMoney(3000, "€", "fr"))).toBe("3 000 €");
  });

  it("never lets an amount break across two lines", () => {
    const formatted = formatMoney(84500, "FCFA", "fr");
    expect(formatted).not.toMatch(/ /);
  });

  it("handles zero and negative balances", () => {
    expect(plain(formatMoney(0, "FCFA", "fr"))).toBe("0 FCFA");
    expect(plain(formatMoney(-1500, "FCFA", "en"))).toBe("-1,500 FCFA");
  });
});

describe("formatDate", () => {
  it("formats in the shop's time zone, not the server's", () => {
    // 23:30 UTC on 31 August is already 1 September in Douala (UTC+1).
    expect(formatDate("2026-08-31T23:30:00Z", "fr", "Africa/Douala")).toBe("01/09/2026");
    expect(formatDate("2026-08-31T23:30:00Z", "fr", "UTC")).toBe("31/08/2026");
  });

  it("follows the interface language", () => {
    expect(formatDate("2026-09-20T10:00:00Z", "en", "Africa/Douala")).toBe("09/20/2026");
    expect(formatDate("2026-09-20T10:00:00Z", "es", "Africa/Douala")).toBe("20/09/2026");
  });
});

describe("dayRangeInTimeZone", () => {
  it("starts the shop's day at local midnight", () => {
    // 00:30 in Douala on 23 September = 23:30 UTC on 22 September.
    const { start, end } = dayRangeInTimeZone(new Date("2026-09-22T23:30:00Z"), "Africa/Douala");
    expect(start.toISOString()).toBe("2026-09-22T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-23T23:00:00.000Z");
  });

  it("keeps a late-evening sale on the same day", () => {
    // 22:59 UTC = 23:59 in Douala, still 23 September.
    const { start } = dayRangeInTimeZone(new Date("2026-09-23T22:59:00Z"), "Africa/Douala");
    expect(start.toISOString()).toBe("2026-09-22T23:00:00.000Z");
  });

  it("works for a UTC shop", () => {
    const { start, end } = dayRangeInTimeZone(new Date("2026-09-23T12:00:00Z"), "UTC");
    expect(start.toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("handles a time zone behind UTC", () => {
    // 02:00 UTC on 23 September is still 22 September in New York (UTC-4 in September).
    const { start } = dayRangeInTimeZone(new Date("2026-09-23T02:00:00Z"), "America/New_York");
    expect(start.toISOString()).toBe("2026-09-22T04:00:00.000Z");
  });
});

import { describe, expect, it } from "vitest";
import { extractVat } from "./vat";

describe("extractVat", () => {
  it("splits a VAT-inclusive total at the Cameroonian rate (19.25 %)", () => {
    const { excludingVat, vatAmount } = extractVat(11925, 1925);
    expect(excludingVat).toBe(10000);
    expect(vatAmount).toBe(1925);
  });

  it("always adds back up to the exact total, even when rounding", () => {
    for (const total of [1, 999, 13000, 84500, 123457]) {
      const { excludingVat, vatAmount } = extractVat(total, 1925);
      expect(excludingVat + vatAmount).toBe(total);
    }
  });

  it("returns no VAT at a zero rate", () => {
    expect(extractVat(5000, 0)).toEqual({ excludingVat: 5000, vatAmount: 0 });
  });
});

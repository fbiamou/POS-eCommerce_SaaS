import { describe, expect, it } from "vitest";
import { buildIntakeUrl, normalizeDeclaredItem, productKey } from "./matching";

describe("productKey", () => {
  it("treats the same name, brand and type as the same product, whatever the case", () => {
    expect(productKey("Perruque Lisse", "LuxeHair", "Lisse")).toBe(productKey(" perruque lisse ", "luxehair", "LISSE"));
  });

  it("tells apart the same name from two brands", () => {
    expect(productKey("Fond de teint NC45", "Mac", null)).not.toBe(productKey("Fond de teint NC45", "Fenty", null));
  });

  it("treats a missing brand or type as empty", () => {
    expect(productKey("Crème", null, undefined)).toBe(productKey("Crème", "", ""));
  });
});

describe("buildIntakeUrl", () => {
  it("builds the public link in the staff's language", () => {
    expect(buildIntakeUrl("https://shop.example/", "es", "abc123")).toBe("https://shop.example/es/procurement/abc123");
  });
});

describe("normalizeDeclaredItem", () => {
  it("cleans what the intermediary typed", () => {
    expect(
      normalizeDeclaredItem({ name: "  Perruque ", category: " Perruques ", brand: "LuxeHair", unit_price: "15000", quantity: "5" })
    ).toEqual({ name: "Perruque", category: "Perruques", type: "", brand: "LuxeHair", unit_price: 15000, quantity: 5 });
  });

  it("accepts an unknown price as zero", () => {
    expect(normalizeDeclaredItem({ name: "Crème", unit_price: "", quantity: 2 })?.unit_price).toBe(0);
  });

  it("refuses a line without a name or with a quantity that is not a whole positive number", () => {
    expect(normalizeDeclaredItem({ name: " ", quantity: 1 })).toBeNull();
    expect(normalizeDeclaredItem({ name: "Robe", quantity: 0 })).toBeNull();
    expect(normalizeDeclaredItem({ name: "Robe", quantity: "1.5" })).toBeNull();
    expect(normalizeDeclaredItem({ name: "Robe", quantity: 1, unit_price: -10 })).toBeNull();
  });
});

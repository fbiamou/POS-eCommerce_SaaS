import { describe, expect, it } from "vitest";
import { buildOrderMessage, describeOrderedItem, orderLines } from "./message";

const line = (name: string, quantity: number, extra: Partial<{ brand: string | null; product_type: string | null; excluded: boolean }> = {}) => ({
  name,
  quantity,
  brand: extra.brand ?? null,
  product_type: extra.product_type ?? null,
  excluded: extra.excluded ?? false,
});

describe("describeOrderedItem", () => {
  it("adds the type and brand the supplier needs", () => {
    expect(describeOrderedItem(line("Perruque 20 pouces", 1, { product_type: "Lisse", brand: "LuxeHair" }))).toBe(
      "Perruque 20 pouces (Lisse, LuxeHair)"
    );
  });

  it("keeps the bare name when nothing else is known", () => {
    expect(describeOrderedItem(line("Crème", 1))).toBe("Crème");
  });
});

describe("orderLines", () => {
  it("leaves out the lines removed from the draft", () => {
    expect(orderLines([line("Robe", 3), line("Crème", 8, { excluded: true })])).toEqual(["3 × Robe"]);
  });
});

describe("buildOrderMessage", () => {
  it("frames the list with the translated header and footer", () => {
    expect(buildOrderMessage("Bonjour Awa, voici notre commande BC-2026-0001 :", [line("Robe", 3), line("Crème", 8)], "Merci. Ma Boutique")).toBe(
      "Bonjour Awa, voici notre commande BC-2026-0001 :\n\n- 3 × Robe\n- 8 × Crème\n\nMerci. Ma Boutique"
    );
  });
});

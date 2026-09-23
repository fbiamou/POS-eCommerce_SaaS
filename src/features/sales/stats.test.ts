import { describe, expect, it } from "vitest";
import { rankTopProducts } from "./stats";

const item = (product_id: string, quantity: number, name: string | null = product_id) => ({
  product_id,
  quantity,
  products: name === null ? null : { name },
});

describe("rankTopProducts", () => {
  it("adds up the quantities of every sale of the same product", () => {
    const ranked = rankTopProducts([item("wig", 2), item("cream", 1), item("wig", 3)], "?", 5);
    expect(ranked).toEqual([
      { productId: "wig", name: "wig", quantity: 5 },
      { productId: "cream", name: "cream", quantity: 1 },
    ]);
  });

  it("keeps only the requested number of products", () => {
    const ranked = rankTopProducts([item("a", 1), item("b", 2), item("c", 3)], "?", 2);
    expect(ranked.map((r) => r.productId)).toEqual(["c", "b"]);
  });

  it("orders ties alphabetically so the list is stable", () => {
    const ranked = rankTopProducts([item("p2", 1, "Zara dress"), item("p1", 1, "Afro wig")], "?", 5);
    expect(ranked.map((r) => r.name)).toEqual(["Afro wig", "Zara dress"]);
  });

  it("labels a product that no longer exists", () => {
    expect(rankTopProducts([item("gone", 1, null)], "Unknown product", 5)[0].name).toBe("Unknown product");
  });

  it("returns an empty list when nothing was sold", () => {
    expect(rankTopProducts([], "?", 5)).toEqual([]);
  });
});

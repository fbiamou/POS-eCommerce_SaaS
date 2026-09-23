// Pure sales statistics, kept free of any database or React code so they can
// be unit-tested (AGENTS.md: every calculation is tested).

export const TOP_SALES_PERIODS = ["day", "week", "month"] as const;
export type TopSalesPeriod = (typeof TOP_SALES_PERIODS)[number];

type SoldItem = {
  product_id: string;
  quantity: number;
  products: { name: string } | null;
};

export type RankedProduct = { productId: string; name: string; quantity: number };

// Sums the quantities sold per product and returns the best sellers first.
// Ties keep a stable, alphabetical order so the list does not jump around
// between two page loads.
export function rankTopProducts(items: SoldItem[], unknownLabel: string, limit: number): RankedProduct[] {
  const totals = new Map<string, RankedProduct>();
  for (const item of items) {
    const existing = totals.get(item.product_id);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      totals.set(item.product_id, {
        productId: item.product_id,
        name: item.products?.name ?? unknownLabel,
        quantity: item.quantity,
      });
    }
  }
  return Array.from(totals.values())
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit);
}

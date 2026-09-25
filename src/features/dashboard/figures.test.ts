import { describe, expect, it } from "vitest";
import { dashboardFigures } from "./figures";

// Malabo is UTC+1: "today" there starts at 23:00 UTC the day before.
const now = new Date("2026-09-26T10:00:00Z");
const invoice = (id: string, createdAt: string, total: number, paid: number, extra: object = {}) => ({
  id,
  invoice_number: `FAC-2026-1-${id}`,
  client_name: null,
  total_amount: total,
  paid_amount: paid,
  status: (paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID") as "PAID" | "PARTIAL" | "UNPAID",
  created_at: createdAt,
  ...extra,
});

const invoices = [
  invoice("0001", "2026-09-25T23:30:00Z", 10000, 10000), // today in Malabo (00:30)
  invoice("0002", "2026-09-26T09:00:00Z", 6500, 5000), // today, 1 500 owed
  invoice("0003", "2026-09-25T22:30:00Z", 4000, 0), // yesterday in Malabo (23:30), 4 000 owed
  invoice("0004", "2026-09-20T10:00:00Z", 3000, 3000), // 6 days ago
  invoice("0005", "2026-09-26T09:30:00Z", 99000, 0, { local_state: "failed" }), // refused: counts nowhere
];
const items = [
  { invoice_id: "0001", product_id: "creme", product_name: "Crème", quantity: 2 },
  { invoice_id: "0002", product_id: "perruque", product_name: "Perruque", quantity: 1 },
  { invoice_id: "0003", product_id: "perruque", product_name: "Perruque", quantity: 3 },
  { invoice_id: "0004", product_id: "sac", product_name: "Sac", quantity: 5 },
  { invoice_id: "0005", product_id: "sac", product_name: "Sac", quantity: 50 },
];
const products = [
  { is_active: true, quantity_in_stock: 5 },
  { is_active: true, quantity_in_stock: -1 },
  { is_active: true, quantity_in_stock: 6 },
  { is_active: false, quantity_in_stock: 0 },
];

const base = { invoices, items, products, now, timeZone: "Africa/Malabo", lowStockThreshold: 5, unknownProduct: "?" };

describe("dashboard figures on the device", () => {
  it("counts today's sales in the shop's own day, not the UTC day", () => {
    const figures = dashboardFigures({ ...base, period: "day" });
    expect(figures.salesCount).toBe(2);
    expect(figures.todayRevenue).toBe(16500);
  });

  it("adds up what remains owed, ignoring a sale the server refused", () => {
    expect(dashboardFigures({ ...base, period: "day" }).totalDebt).toBe(5500);
  });

  it("counts active items at or under the threshold, stock to check included", () => {
    expect(dashboardFigures({ ...base, period: "day" }).lowStockCount).toBe(2);
  });

  it("lists the five latest invoices, newest first", () => {
    expect(dashboardFigures({ ...base, period: "day" }).recentInvoices.map((i) => i.id)).toEqual(["0002", "0001", "0003", "0004"]);
  });

  it("ranks best sellers over the chosen period", () => {
    expect(dashboardFigures({ ...base, period: "day" }).topArticles).toEqual([
      { productId: "creme", name: "Crème", quantity: 2 },
      { productId: "perruque", name: "Perruque", quantity: 1 },
    ]);
    expect(dashboardFigures({ ...base, period: "week" }).topArticles.map((a) => [a.name, a.quantity])).toEqual([
      ["Sac", 5],
      ["Perruque", 4],
      ["Crème", 2],
    ]);
  });
});

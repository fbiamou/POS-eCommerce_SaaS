import { dayRangeInTimeZone } from "@/lib/format";
import { rankTopProducts, type RankedProduct, type TopSalesPeriod } from "@/features/sales/stats";

// The dashboard's figures computed from the device's copy of the shop, with
// the same rules as the server page (dashboard/page.tsx): today is the
// shop's calendar day, debts are what remains on unpaid and partly paid
// invoices, low stock is at or under the shop's threshold, best sellers are
// ranked over the last 1, 7 or 30 days, today included. A sale the server
// refused (« à vérifier ») counts nowhere.

type Invoice = {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  total_amount: number;
  paid_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  created_at: string;
  local_state?: "pending" | "failed";
};
type Item = { invoice_id: string; product_id: string; product_name: string; quantity: number };
type Product = { is_active: boolean; quantity_in_stock: number };

export type RecentInvoice = Pick<Invoice, "id" | "invoice_number" | "client_name" | "total_amount" | "status" | "local_state">;

export type DashboardFigures = {
  todayRevenue: number;
  salesCount: number;
  totalDebt: number;
  lowStockCount: number;
  recentInvoices: RecentInvoice[];
  topArticles: RankedProduct[];
};

const PERIOD_DAYS: Record<TopSalesPeriod, number> = { day: 1, week: 7, month: 30 };

export function dashboardFigures(input: {
  invoices: Invoice[];
  items: Item[];
  products: Product[];
  now: Date;
  timeZone: string;
  lowStockThreshold: number;
  period: TopSalesPeriod;
  unknownProduct: string;
}): DashboardFigures {
  const today = dayRangeInTimeZone(input.now, input.timeZone);
  const periodStart = today.start.getTime() - (PERIOD_DAYS[input.period] - 1) * 24 * 60 * 60 * 1000;
  const counted = input.invoices.filter((inv) => inv.local_state !== "failed");
  const within = (iso: string, start: number) => {
    const time = new Date(iso).getTime();
    return time >= start && time < today.end.getTime();
  };

  const todays = counted.filter((inv) => within(inv.created_at, today.start.getTime()));
  const inPeriod = new Set(counted.filter((inv) => within(inv.created_at, periodStart)).map((inv) => inv.id));

  return {
    todayRevenue: todays.reduce((sum, inv) => sum + inv.total_amount, 0),
    salesCount: todays.length,
    totalDebt: counted.filter((inv) => inv.status !== "PAID").reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0),
    lowStockCount: input.products.filter((p) => p.is_active && p.quantity_in_stock <= input.lowStockThreshold).length,
    recentInvoices: [...counted]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(({ id, invoice_number, client_name, total_amount, status, local_state }) => ({ id, invoice_number, client_name, total_amount, status, local_state })),
    topArticles: rankTopProducts(
      input.items
        .filter((item) => inPeriod.has(item.invoice_id))
        .map((item) => ({ product_id: item.product_id, quantity: item.quantity, products: { name: item.product_name } })),
      input.unknownProduct,
      5
    ),
  };
}

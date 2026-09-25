"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useLocalProducts } from "@/features/offline/hooks";

type SummaryProduct = { quantity_in_stock: number; purchase_price: number | null };

// The four figures at the top of the stock page. With offline mode they come
// from the device's copy (a sale made offline lowers the stock at once);
// until the device has its copy, from the server's.
export function StockSummary({ serverProducts, itemLimit }: { serverProducts: SummaryProduct[]; itemLimit: number | null }) {
  const t = useTranslations("Stock");
  const tPlans = useTranslations("Plans");
  const format = useShopFormat();
  const localProducts = useLocalProducts();
  const products: SummaryProduct[] = localProducts ?? serverProducts;

  const summary = {
    items: products.length,
    units: products.reduce((sum, p) => sum + Math.max(0, p.quantity_in_stock), 0),
    low: products.filter((p) => format.isLowStock(p.quantity_in_stock)).length,
    value: products.reduce((sum, p) => sum + Math.max(0, p.quantity_in_stock) * (p.purchase_price ?? 0), 0),
  };

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
        <dt className="text-[12px] font-semibold text-zinc-500">{t("summary_items")}</dt>
        <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">
          {summary.items}
          {itemLimit !== null && <span className="ml-1 font-sans text-[12px] font-semibold text-zinc-500">{tPlans("of_limit", { limit: itemLimit })}</span>}
        </dd>
      </div>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
        <dt className="text-[12px] font-semibold text-zinc-500">{t("summary_units")}</dt>
        <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{summary.units}</dd>
      </div>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
        <dt className="text-[12px] font-semibold text-zinc-500">{t("summary_low")}</dt>
        <dd className="mt-1 flex items-baseline justify-between gap-2">
          <span className={`font-mono text-xl font-semibold tabular-nums ${summary.low > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{summary.low}</span>
          {summary.low > 0 && (
            <Link href="/purchase-orders" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-violet-700 hover:underline dark:text-violet-300">
              {t("reorder")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </dd>
      </div>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
        <dt className="text-[12px] font-semibold text-zinc-500">{t("summary_value")}</dt>
        <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{format.money(summary.value)}</dd>
      </div>
    </dl>
  );
}

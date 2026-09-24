"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, FileText } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { generatePurchaseOrders } from "../actions";
import { PURCHASE_ORDER_STATUS_STYLES } from "../status";
import type { LowStockProduct, PurchaseOrderSummary } from "../queries";
import { describeOrderedItem } from "../message";

export default function PurchaseOrderList({
  lowStock,
  orders,
}: {
  lowStock: LowStockProduct[];
  orders: PurchaseOrderSummary[];
}) {
  const t = useTranslations("PurchaseOrders");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const toOrder = lowStock.filter((product) => !product.in_open_order);

  const generate = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await generatePurchaseOrders();
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(t("generated", { count: result.created ?? 0 }));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <h2 className="font-bold text-amber-900 dark:text-amber-200">{t("low_stock_items")}</h2>
              <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
                {t("low_stock_description", { threshold: format.lowStockThreshold })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={isPending || toOrder.length === 0}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {t("generate")}
          </button>
        </div>

        {lowStock.length === 0 ? (
          <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-200/80">{t("no_low_stock")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {lowStock.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-sm dark:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{describeOrderedItem(product)}</p>
                  <p className="text-xs text-zinc-500">{product.supplier_name || t("no_supplier")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {product.in_open_order && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                      {t("already_ordered")}
                    </span>
                  )}
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900">
                    {t("stock_count", { stock: product.quantity_in_stock })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {notice && <p className="mt-3 text-sm font-bold text-emerald-700">{notice}</p>}
        {error && <p className="mt-3 text-sm font-bold text-red-600">{tFeedback(error)}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("history")}</h2>
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-zinc-100 bg-white p-6 text-center text-sm text-zinc-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
            {t("no_history")}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/purchase-orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm hover:border-violet-300 dark:border-[var(--line)] dark:bg-[var(--surface-1)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold">{order.reference}</p>
                      <p className="truncate text-xs text-zinc-500">{order.supplier_name || t("no_supplier")}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${PURCHASE_ORDER_STATUS_STYLES[order.status]}`}>
                      {t(`status_${order.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t("order_summary", { lines: order.line_count, units: order.unit_count, date: format.date(order.created_at) })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

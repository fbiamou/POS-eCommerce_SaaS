"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Check, X, Package } from "lucide-react";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { confirmOnlineOrder, cancelOnlineOrder, type OnlineOrder } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function OnlineOrderList({ orders }: { orders: OnlineOrder[] }) {
  const t = useTranslations("OnlineOrders");
  const tFeedback = useTranslations("Feedback");
  const shopFormat = useShopFormat();
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedInvoiceId, setConfirmedInvoiceId] = useState<{ orderId: string; invoiceId: string } | null>(null);
  const [error, setError] = useState<FeedbackCode | null>(null);

  const format = shopFormat.money;

  const handleConfirm = (order: OnlineOrder) => {
    setError(null);
    setProcessingId(order.id);
    startTransition(async () => {
      // The customer pays at pickup: the invoice starts unpaid, and the
      // payment is recorded on it when she collects her order.
      const result = await confirmOnlineOrder(order.id, 0);
      if (result.error) {
        setError(result.error);
      } else if (result.invoiceId) {
        setConfirmedInvoiceId({ orderId: order.id, invoiceId: result.invoiceId });
      }
    });
  };

  const handleCancel = (order: OnlineOrder) => {
    if (!confirm(t("confirm_cancel"))) return;
    setError(null);
    setProcessingId(order.id);
    startTransition(async () => {
      const result = await cancelOnlineOrder(order.id);
      if (result.error) setError(result.error);
    });
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-zinc-500">
        {t("no_orders")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{tFeedback(error)}</p>}
      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-sm text-zinc-500">{order.customer_phone}</p>
              <p className="text-xs text-zinc-500">{shopFormat.date(order.created_at, "dateTime")}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
              {t(`status_${order.status.toLowerCase()}`)}
            </span>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex justify-between">
                <span>
                  {item.quantity} × {item.product_name}
                </span>
                <span>{format(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex justify-between border-t pt-2 font-bold">
            <span>{t("total")}</span>
            <span>{format(order.total_amount)}</span>
          </div>

          {order.status === "PENDING" && (
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCancel(order)}
                disabled={isPending && processingId === order.id}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" /> {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(order)}
                disabled={isPending && processingId === order.id}
                className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {t("confirm")}
              </button>
            </div>
          )}

          {confirmedInvoiceId?.orderId === order.id && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-900/20 p-2 text-sm text-green-700 dark:text-green-400">
              <Package className="h-4 w-4" />
              <span>{t("confirmed_success")}</span>
              <Link href={`/invoices/${confirmedInvoiceId.invoiceId}`} className="ml-auto font-medium underline">
                {t("view_invoice")}
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

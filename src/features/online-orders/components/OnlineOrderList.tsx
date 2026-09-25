"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Check, X, Package, MessageCircle, ShoppingBag } from "lucide-react";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { FeedbackCode } from "@/lib/feedback";
import { confirmOnlineOrder, cancelOnlineOrder, type OnlineOrder } from "../actions";

const STATUS_STYLES: Record<OnlineOrder["status"], string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

// The customer is not notified automatically: a wa.me link opens the staff
// member's own WhatsApp on her number, like a person writing to her.
function whatsAppUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export default function OnlineOrderList({ orders }: { orders: OnlineOrder[] }) {
  const t = useTranslations("OnlineOrders");
  const tFeedback = useTranslations("Feedback");
  const shopFormat = useShopFormat();
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedInvoiceId, setConfirmedInvoiceId] = useState<{ orderId: string; invoiceId: string } | null>(null);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [toCancel, setToCancel] = useState<OnlineOrder | null>(null);
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const [filter, setFilter] = useState<"pending" | "all">(pendingCount > 0 ? "pending" : "all");

  const format = shopFormat.money;
  const visible = filter === "pending" ? orders.filter((o) => o.status === "PENDING") : orders;

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

  const handleCancel = () => {
    if (!toCancel) return;
    const order = toCancel;
    setError(null);
    setProcessingId(order.id);
    startTransition(async () => {
      const result = await cancelOnlineOrder(order.id);
      setToCancel(null);
      if (result.error) setError(result.error);
    });
  };

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-night text-white dark:bg-violet-500"
        : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--surface-1)] px-6 py-10 text-center shadow-card">
        <ShoppingBag className="h-10 w-10 text-zinc-300" />
        <p className="font-semibold">{t("no_orders")}</p>
        <p className="max-w-sm text-[14px] text-zinc-500">{t("no_orders_hint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => setFilter("pending")} className={chipClass(filter === "pending")}>
          {t("filter_pending")} <span className="ml-1 font-mono tabular-nums opacity-70">{pendingCount}</span>
        </button>
        <button type="button" onClick={() => setFilter("all")} className={chipClass(filter === "all")}>
          {t("filter_all")} <span className="ml-1 font-mono tabular-nums opacity-70">{orders.length}</span>
        </button>
      </div>

      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-1)] p-8 text-center shadow-card">
          <Check className="h-8 w-8 text-emerald-600" />
          <p className="text-[14px] text-zinc-500">{t("nothing_pending")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((order) => {
            const busy = isPending && processingId === order.id;
            return (
              <li key={order.id} className="flex flex-col rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{order.customer_name}</p>
                    <p className="font-mono text-[12.5px] text-zinc-500">{order.customer_phone}</p>
                    <p className="text-[12px] text-zinc-500">{shopFormat.date(order.created_at, "dateTime")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[order.status]}`}>
                    {t(`status_${order.status.toLowerCase()}`)}
                  </span>
                </div>

                <ul className="mt-3 space-y-1 text-[14px] text-zinc-600 dark:text-zinc-400">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-mono tabular-nums">{item.quantity}</span> × {item.product_name}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">{format(item.unit_price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-baseline justify-between border-t border-zinc-100 pt-3 dark:border-[var(--line)]">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{t("total")}</span>
                  <span className="font-mono text-lg font-semibold tabular-nums">{format(order.total_amount)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={whatsAppUrl(order.customer_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    <MessageCircle className="h-4 w-4" /> {t("contact_customer")}
                  </a>
                  {order.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setToCancel(order)}
                        disabled={busy}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/5"
                      >
                        <X className="h-4 w-4" /> {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirm(order)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {t("confirm")}
                      </button>
                    </>
                  )}
                </div>

                {confirmedInvoiceId?.orderId === order.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-[13px] text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <Package className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{t("confirmed_success")}</span>
                    <Link href={`/invoices/${confirmedInvoiceId.invoiceId}`} className="font-semibold underline">
                      {t("view_invoice")}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={toCancel !== null}
        title={t("cancel_title")}
        confirmLabel={t("cancel_order")}
        tone="danger"
        pending={isPending}
        onConfirm={handleCancel}
        onCancel={() => setToCancel(null)}
      >
        {t("confirm_cancel")}
      </ConfirmDialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, MessageCircle } from "lucide-react";
import { buildWhatsAppClickToChatUrl } from "@/features/reminders/whatsapp";
import type { FeedbackCode } from "@/lib/feedback";
import { setPurchaseOrderStatus, updatePurchaseOrderLine } from "../actions";
import { buildOrderMessage, describeOrderedItem } from "../message";
import type { PurchaseOrderDetail } from "../queries";

export function PurchaseOrderEditor({ order, shopName }: { order: PurchaseOrderDetail; shopName: string }) {
  const t = useTranslations("PurchaseOrders");
  const tFeedback = useTranslations("Feedback");
  const locale = useLocale();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((line) => [line.id, String(line.quantity)]))
  );
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDraft = order.status === "DRAFT";

  const saveLine = (lineId: string, excluded: boolean) => {
    const quantity = Number(quantities[lineId]);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("invalid_quantity");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePurchaseOrderLine(order.id, lineId, quantity, excluded);
      if (result.error) setError(result.error);
    });
  };

  const changeStatus = (status: "SENT" | "RECEIVED" | "CANCELLED", confirmKey?: string) => {
    if (confirmKey && !confirm(t(confirmKey))) return;
    setError(null);
    startTransition(async () => {
      const result = await setPurchaseOrderStatus(order.id, status);
      if (result.error) setError(result.error);
    });
  };

  const message = buildOrderMessage(
    t("whatsapp_header", { supplier: order.supplier_name ?? "", reference: order.reference }),
    order.lines.map((line) => ({ ...line, quantity: Number(quantities[line.id]) || line.quantity })),
    t("whatsapp_footer", { shop: shopName })
  );
  // Without the supplier's number, WhatsApp opens its contact picker.
  const whatsappUrl = order.supplier_phone
    ? buildWhatsAppClickToChatUrl(order.supplier_phone, message)
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-white dark:divide-white/5 dark:border-[#2d2936] dark:bg-[#1C1A22]">
        {order.lines.map((line) => (
          <li key={line.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${line.excluded ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${line.excluded ? "line-through" : ""}`}>{describeOrderedItem(line)}</p>
              <p className="text-xs text-zinc-500">
                {t("stock_then_now", { then: line.stock_at_creation, now: line.current_stock })}
              </p>
            </div>
            {isDraft ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label={t("quantity")}
                  value={quantities[line.id] ?? ""}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                  onBlur={() => Number(quantities[line.id]) !== line.quantity && saveLine(line.id, line.excluded)}
                  disabled={line.excluded || isPending}
                  className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-[#2d2936] dark:bg-[#14121a]"
                />
                <button
                  type="button"
                  onClick={() => saveLine(line.id, !line.excluded)}
                  disabled={isPending}
                  className="rounded-lg px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  {line.excluded ? t("include_line") : t("exclude_line")}
                </button>
              </div>
            ) : (
              <p className="text-sm font-bold tabular-nums">{t("quantity_value", { quantity: line.quantity })}</p>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="text-sm font-medium text-red-600">{tFeedback(error)}</p>}

      <div className="flex flex-wrap gap-2">
        {(isDraft || order.status === "SENT") && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => isDraft && changeStatus("SENT")}
            className="flex items-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#0e6f63]"
          >
            <MessageCircle className="h-4 w-4" /> {isDraft ? t("send_whatsapp") : t("resend_whatsapp")}
          </a>
        )}
        {/* A generated file served by an API route, not a page navigation. */}
        <a
          href={`/api/purchase-orders/${order.id}/pdf?locale=${locale}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-50 dark:border-[#2d2936] dark:hover:bg-white/5"
        >
          <Download className="h-4 w-4" /> {t("download_pdf")}
        </a>
        {isDraft && (
          <button
            type="button"
            onClick={() => changeStatus("SENT")}
            disabled={isPending}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-50 dark:border-[#2d2936] dark:hover:bg-white/5"
          >
            {t("mark_sent")}
          </button>
        )}
        {order.status === "SENT" && (
          <button
            type="button"
            onClick={() => changeStatus("RECEIVED", "confirm_received")}
            disabled={isPending}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-50 dark:border-[#2d2936] dark:hover:bg-white/5"
          >
            {t("mark_received")}
          </button>
        )}
        {(isDraft || order.status === "SENT") && (
          <button
            type="button"
            onClick={() => changeStatus("CANCELLED", "confirm_cancel_order")}
            disabled={isPending}
            className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {t("cancel_order")}
          </button>
        )}
      </div>
    </div>
  );
}

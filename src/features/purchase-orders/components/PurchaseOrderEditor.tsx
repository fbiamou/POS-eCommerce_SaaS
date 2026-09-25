"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, MessageCircle, PackageCheck, Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { buildWhatsAppClickToChatUrl } from "@/features/reminders/whatsapp";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { FeedbackCode } from "@/lib/feedback";
import { deletePurchaseOrder, receivePurchaseOrder, setPurchaseOrderStatus, updatePurchaseOrderLine } from "../actions";
import { buildOrderMessage, describeOrderedItem } from "../message";
import { buildReceivedPayload, initialReceived, receptionSummary, type ReceivedEntry } from "../reception";
import type { PurchaseOrderDetail } from "../queries";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff } from "lucide-react";
import { useOptionalOfflineContext } from "@/features/offline/OfflineProvider";
import { receivePurchaseOrderOffline } from "@/features/offline/localActions";
import { purchaseOrderMarker } from "@/features/offline/db";

const secondaryButton =
  "flex items-center gap-2 rounded-xl bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-semibold text-zinc-800 shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200";

export function PurchaseOrderEditor({ order, shopName }: { order: PurchaseOrderDetail; shopName: string }) {
  const t = useTranslations("PurchaseOrders");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const locale = useLocale();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((line) => [line.id, String(line.quantity)]))
  );
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  // Reception: the owner checks off what the supplier actually delivered.
  const [receiving, setReceiving] = useState(false);
  const [received, setReceived] = useState<Record<string, string>>(() => initialReceived(order.lines));
  const [pendingEntries, setPendingEntries] = useState<ReceivedEntry[] | null>(null);
  // Offline mode: a delivery checked off without internet is kept on the
  // device; the page (a kept copy) still says "sent" until it is sent.
  const offline = useOptionalOfflineContext();
  const tOffline = useTranslations("Offline");
  const receivedOnDevice = useLiveQuery(
    async () => (offline ? Boolean(await offline.db.meta.get(purchaseOrderMarker(order.id))) : false),
    [offline?.db, order.id],
    false
  );

  const isDraft = order.status === "DRAFT";
  const isSent = order.status === "SENT";
  // A purchase order followed by a shipment link is received through that
  // shipment; checking it off here too would count the goods twice.
  const hasActiveShipment = order.shipments.some((s) => s.status !== "CANCELLED");
  const canReceive = isSent && !hasActiveShipment && !receivedOnDevice;
  const activeLines = order.lines.filter((line) => !line.excluded);

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

  const changeStatus = (status: "SENT" | "CANCELLED") => {
    setError(null);
    startTransition(async () => {
      const result = await setPurchaseOrderStatus(order.id, status);
      setConfirmCancel(false);
      if (result.error) setError(result.error);
    });
  };

  const deleteOrder = () => {
    setError(null);
    startTransition(async () => {
      const result = await deletePurchaseOrder(order.id);
      setConfirmDelete(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/purchase-orders");
    });
  };

  const askReceptionConfirm = () => {
    const payload = buildReceivedPayload(order.lines, received);
    if ("error" in payload) {
      setError(payload.error);
      return;
    }
    setError(null);
    setPendingEntries(payload.entries);
  };

  const confirmReception = () => {
    if (!pendingEntries) return;
    const entries = pendingEntries;
    const keepOnDevice = async () => {
      if (!offline) return;
      await receivePurchaseOrderOffline(offline, order, entries);
      setPendingEntries(null);
      setReceiving(false);
      showToast(tOffline("po_received_offline"));
    };
    startTransition(async () => {
      if (offline && !offline.status.online) {
        await keepOnDevice();
        return;
      }
      let result: Awaited<ReturnType<typeof receivePurchaseOrder>>;
      try {
        result = await receivePurchaseOrder(order.id, entries);
      } catch {
        if (offline) await keepOnDevice();
        else setError("generic_error");
        return;
      }
      offline?.requestSync();
      setPendingEntries(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReceiving(false);
      showToast(t("received_toast"));
    });
  };

  const stepReceived = (lineId: string, delta: number) =>
    setReceived((prev) => ({ ...prev, [lineId]: String(Math.max(0, (parseInt(prev[lineId] ?? "0", 10) || 0) + delta)) }));

  const message = buildOrderMessage(
    t("whatsapp_header", { supplier: order.supplier_name ?? "", reference: order.reference }),
    order.lines.map((line) => ({ ...line, quantity: Number(quantities[line.id]) || line.quantity })),
    t("whatsapp_footer", { shop: shopName })
  );
  // Without the supplier's number, WhatsApp opens its contact picker.
  const whatsappUrl = order.supplier_phone
    ? buildWhatsAppClickToChatUrl(order.supplier_phone, message)
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  const summary = pendingEntries ? receptionSummary(order.lines, pendingEntries) : null;

  return (
    <div className="flex flex-col gap-4">
      {receiving && (
        <p className="rounded-2xl bg-violet-50 p-4 text-[14px] text-violet-900 dark:text-violet-200">{t("reception_hint")}</p>
      )}

      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
        {order.lines.map((line) => (
          <li key={line.id} className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center ${line.excluded ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] font-semibold ${line.excluded ? "line-through" : ""}`}>{describeOrderedItem(line)}</p>
              <p className="text-[12.5px] text-zinc-500">
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
                  className="w-24 rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3 py-2 font-mono text-[14px] dark:border-[var(--line)]"
                />
                <button
                  type="button"
                  onClick={() => saveLine(line.id, !line.excluded)}
                  disabled={isPending}
                  className="rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300"
                >
                  {line.excluded ? t("include_line") : t("exclude_line")}
                </button>
              </div>
            ) : receiving && !line.excluded ? (
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-zinc-500">{t("ordered_value", { quantity: line.quantity })}</span>
                <div className="flex items-center rounded-full bg-zinc-100 dark:bg-[var(--surface-2)]">
                  <button type="button" aria-label={t("one_less")} onClick={() => stepReceived(line.id, -1)} className="rounded-full p-2.5 hover:bg-zinc-200 dark:hover:bg-[var(--surface-3)]">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t("received_quantity")}
                    value={received[line.id] ?? ""}
                    onChange={(e) => setReceived((prev) => ({ ...prev, [line.id]: e.target.value }))}
                    className="w-12 bg-transparent text-center font-mono text-[15px] font-semibold tabular-nums outline-none"
                  />
                  <button type="button" aria-label={t("one_more")} onClick={() => stepReceived(line.id, 1)} className="rounded-full p-2.5 hover:bg-zinc-200 dark:hover:bg-[var(--surface-3)]">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : order.status === "RECEIVED" && line.received_quantity !== null ? (
              <p className={`font-mono text-[13px] font-semibold tabular-nums ${line.received_quantity < line.quantity ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {t("received_of_ordered", { received: line.received_quantity, ordered: line.quantity })}
              </p>
            ) : (
              <p className="font-mono text-[13px] font-semibold tabular-nums">
                {order.status === "DRAFT" || isSent ? t("quantity_value", { quantity: line.quantity }) : t("ordered_value", { quantity: line.quantity })}
              </p>
            )}
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-[14px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">{tFeedback(error)}</p>}

      {receivedOnDevice && isSent && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[14px] font-semibold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          {tOffline("po_received_offline")}
        </p>
      )}

      {receiving ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={askReceptionConfirm}
            disabled={isPending || activeLines.length === 0}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <PackageCheck className="h-5 w-5" /> {t("validate_reception")}
          </button>
          <button
            type="button"
            onClick={() => {
              setReceiving(false);
              setReceived(initialReceived(order.lines));
              setError(null);
            }}
            className="rounded-xl px-4 py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300"
          >
            {t("cancel_reception")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canReceive && (
            <button
              type="button"
              onClick={() => setReceiving(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-violet-700 sm:w-auto"
            >
              <PackageCheck className="h-5 w-5" /> {t("receive_order")}
            </button>
          )}
          {(isDraft || isSent) && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => isDraft && changeStatus("SENT")}
              className="flex items-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#0e6f63]"
            >
              <MessageCircle className="h-4 w-4" /> {isDraft ? t("send_whatsapp") : t("resend_whatsapp")}
            </a>
          )}
          {/* A generated file served by an API route, not a page navigation. */}
          <a href={`/api/purchase-orders/${order.id}/pdf?locale=${locale}`} target="_blank" rel="noreferrer" className={secondaryButton}>
            <Download className="h-4 w-4" /> {t("download_pdf")}
          </a>
          {isDraft && (
            <button type="button" onClick={() => changeStatus("SENT")} disabled={isPending} className={secondaryButton}>
              {t("mark_sent")}
            </button>
          )}
          {(isDraft || isSent) && (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={isPending}
              className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t("cancel_order")}
            </button>
          )}
          {(isDraft || order.status === "CANCELLED") && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" /> {t("delete_order")}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmCancel}
        title={t("cancel_order")}
        confirmLabel={t("cancel_order")}
        tone="danger"
        pending={isPending}
        onConfirm={() => changeStatus("CANCELLED")}
        onCancel={() => setConfirmCancel(false)}
      >
        {t("confirm_cancel_order")}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t("delete_order_title", { reference: order.reference })}
        confirmLabel={t("delete_order")}
        tone="danger"
        pending={isPending}
        onConfirm={deleteOrder}
        onCancel={() => setConfirmDelete(false)}
      >
        {t("confirm_delete_order")}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={pendingEntries !== null}
        title={t("validate_reception")}
        confirmLabel={t("confirm_reception")}
        pending={isPending}
        onConfirm={confirmReception}
        onCancel={() => setPendingEntries(null)}
      >
        {summary && (
          <div className="flex flex-col gap-2">
            <p>{t("reception_units", { units: summary.units })}</p>
            {summary.shortLines > 0 && <p className="text-amber-700 dark:text-amber-400">{t("reception_short", { count: summary.shortLines })}</p>}
            {summary.overLines > 0 && <p>{t("reception_over", { count: summary.overLines })}</p>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

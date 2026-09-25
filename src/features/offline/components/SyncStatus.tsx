"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { isFeedbackCode } from "@/lib/feedback";
import { useOptionalOfflineContext } from "../OfflineProvider";
import { dismissFailed, retryFailed } from "../localActions";
import type { OutboxEntry } from "../db";

// Where the device stands, always visible in the app's bar: offline (with
// what waits to be sent), sending, refused operations to check, or up to
// date. A tap opens the detail.
export function SyncStatus({ tone = "light" }: { tone?: "light" | "dark" }) {
  const offline = useOptionalOfflineContext();
  const t = useTranslations("Offline");
  const [open, setOpen] = useState(false);
  if (!offline) return null;
  const { status } = offline;

  const base = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold";
  let pill: { className: string; icon: React.ReactNode; label: string };
  if (status.failed > 0) {
    pill = {
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      icon: <TriangleAlert className="h-3.5 w-3.5" />,
      label: t("status_to_check", { count: status.failed }),
    };
  } else if (!status.online) {
    pill = {
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
      icon: <CloudOff className="h-3.5 w-3.5" />,
      label: status.pending > 0 ? `${t("status_offline")} · ${t("status_to_send", { count: status.pending })}` : t("status_offline"),
    };
  } else if (status.pending > 0) {
    pill = {
      className: tone === "dark" ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700 dark:bg-[var(--surface-2)] dark:text-zinc-200",
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      label: `${t("status_sending")} ${status.pending}`,
    };
  } else {
    pill = {
      className: tone === "dark" ? "text-[var(--nav-fg)] hover:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
      label: t("status_up_to_date"),
    };
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${base} ${pill.className}`} aria-haspopup="dialog">
        {pill.icon}
        <span className="truncate">{pill.label}</span>
      </button>
      {open && <SyncPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SyncPanel({ onClose }: { onClose: () => void }) {
  const offline = useOptionalOfflineContext()!;
  const { db, status, requestSync } = offline;
  const t = useTranslations("Offline");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const failed = useLiveQuery(() => db.outbox.where("state").equals("failed").toArray(), [db], []);
  const invoiceNumbers = useLiveQuery(
    async () => {
      const ids = failed.filter((e) => e.kind === "sale").map((e) => e.ref_id);
      const rows = await db.invoices.bulkGet(ids);
      return new Map(rows.filter(Boolean).map((row) => [row!.id, row!.invoice_number]));
    },
    [db, failed],
    new Map<string, string | null>()
  );

  const describe = (entry: OutboxEntry) => {
    if (entry.kind === "sale") return t("kind_sale", { number: invoiceNumbers.get(entry.ref_id) ?? "" });
    if (entry.kind === "payment") return t("kind_payment", { amount: format.money(entry.payload.amount) });
    if (entry.kind === "product_create") return t("kind_product_create", { name: entry.payload.name });
    if (entry.kind === "product_update") return t("kind_product_update", { name: entry.payload.name });
    if (entry.kind === "po_receive") return t("kind_po_receive", { reference: entry.payload.reference });
    return t("kind_client", { name: entry.payload.name });
  };

  return (
    <Modal isOpen onClose={onClose} title={t("panel_title")}>
      <div className="flex flex-col gap-4 text-[14px]">
        <p className={status.online ? "text-zinc-700 dark:text-zinc-200" : "font-semibold text-amber-900 dark:text-amber-200"}>
          {status.online ? t("panel_online") : t("panel_offline")}
        </p>
        <p className="text-zinc-500">
          {status.lastSyncAt ? t("panel_last_sync", { time: format.date(status.lastSyncAt, "dateTime") }) : t("panel_never")}
        </p>
        <p className="font-semibold">{t("panel_pending", { count: status.pending })}</p>

        {failed.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl bg-red-50 p-4 dark:bg-red-900/20">
            <h3 className="font-bold text-red-800 dark:text-red-300">{t("panel_failed_title")}</h3>
            <p className="text-[13px] text-red-900/80 dark:text-red-200/80">{t("panel_failed_intro")}</p>
            <ul className="flex flex-col gap-2">
              {failed.map((entry) => (
                <li key={entry.seq} className="rounded-xl bg-[var(--surface-1)] p-3">
                  <p className="font-semibold">{describe(entry)}</p>
                  <p className="text-[12.5px] text-zinc-500">
                    {format.date(entry.created_at, "dateTime")}
                    {entry.error && isFeedbackCode(entry.error) ? ` · ${tFeedback(entry.error)}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void retryFailed(db, entry).then(requestSync)}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-violet-700"
                    >
                      {t("retry")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void dismissFailed(db, entry)}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300"
                    >
                      {t("dismiss")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={requestSync}
          disabled={status.syncing}
          className="flex items-center justify-center gap-2 rounded-xl bg-night py-3 text-[14px] font-bold text-white disabled:opacity-50 dark:bg-violet-500"
        >
          <RefreshCw className={`h-4 w-4 ${status.syncing ? "animate-spin" : ""}`} />
          {t("sync_now")}
        </button>
      </div>
    </Modal>
  );
}

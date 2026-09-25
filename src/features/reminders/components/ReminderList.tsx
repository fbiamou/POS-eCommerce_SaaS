"use client";

import { useTransition, useState } from "react";
import { MessageCircle, CheckCircle2, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { sendReminder, type OverdueInvoice } from "../actions";
import { useToast } from "@/components/ui/Toast";

export type { OverdueInvoice };

export default function ReminderList({
  invoices,
}: {
  invoices: OverdueInvoice[];
}) {
  const t = useTranslations("Reminders");
  const showToast = useToast((state) => state.show);
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const [isPending, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; code: FeedbackCode } | null>(null);

  const handleSendReminder = (invoice: OverdueInvoice) => {
    setSendingId(invoice.id);
    setFailure(null);

    // Open a blank tab synchronously, inside the click handler, so browsers
    // don't treat the later navigation (after the server round-trip below)
    // as a blocked popup — only the initial window.open() call counts as
    // being "in response to a user gesture".
    const pendingTab = window.open("", "_blank");

    startTransition(async () => {
      const result = await sendReminder(invoice.id);
      setSendingId(null);

      if (result.error) {
        pendingTab?.close();
        setFailure({ id: invoice.id, code: result.error });
        return;
      }
      const amount = format.money(result.amountDue ?? invoice.total_amount - invoice.paid_amount);

      if (result.whatsappUrl) {
        if (pendingTab) {
          pendingTab.location.href = result.whatsappUrl;
        } else {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
        }
        showToast(t("manual_alert", { name: invoice.client_name, amount }));
      } else {
        pendingTab?.close();
        showToast(t("success_alert", { name: invoice.client_name, amount }));
      }
    });
  };

  return (
    <section aria-labelledby="eligible-invoices" className="flex flex-col gap-3">
      <h2 id="eligible-invoices" className="text-lg font-bold">{t("eligible_invoices")}</h2>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-1)] p-8 text-center shadow-card">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-[14px] text-zinc-500">{t("no_invoices")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {invoices.map((invoice) => {
            const dueAmount = invoice.total_amount - invoice.paid_amount;
            const sending = isPending && sendingId === invoice.id;
            return (
              <li key={invoice.id} className="flex flex-col rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{invoice.client_name}</p>
                    <p className="truncate font-mono text-[12px] text-zinc-500">
                      {[invoice.invoice_number, invoice.client_phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">{format.money(dueAmount)}</p>
                    <p className="text-[12px] font-semibold text-red-600 dark:text-red-400">{t("days_late", { days: invoice.days_overdue })}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-[var(--line)]">
                  <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                    <History className="h-3.5 w-3.5" />
                    {invoice.last_reminder_at
                      ? t("last_reminder_on", { date: format.date(invoice.last_reminder_at), count: invoice.reminder_count })
                      : t("never_reminded")}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendReminder(invoice)}
                    disabled={sending || !invoice.client_phone}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
                  >
                    <MessageCircle className="h-4 w-4" /> {sending ? t("sending") : t("send")}
                  </button>
                </div>

                {!invoice.client_phone && <p className="mt-2 text-[12.5px] text-amber-700 dark:text-amber-400">{t("no_phone")}</p>}
                {failure?.id === invoice.id && (
                  <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-600">{tFeedback(failure.code)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

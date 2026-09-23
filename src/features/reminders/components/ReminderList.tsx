"use client";

import { useTransition, useState } from "react";
import { MessageCircle, CheckCircle2, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { sendReminder, type OverdueInvoice } from "../actions";

export type { OverdueInvoice };

export default function ReminderList({
  invoices,
}: {
  invoices: OverdueInvoice[];
}) {
  const t = useTranslations("Reminders");
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
        alert(t("manual_alert", { name: invoice.client_name, amount }));
      } else {
        pendingTab?.close();
        alert(t("success_alert", { name: invoice.client_name, amount }));
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{t("eligible_invoices")}</h2>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-[#2d2936]">
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("client")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("phone")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("overdue_days")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("remaining_due")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("last_reminder")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
              {invoices.map((invoice) => {
                const dueAmount = invoice.total_amount - invoice.paid_amount;
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <span className="font-bold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">{invoice.client_name}</span>
                      {invoice.invoice_number && (
                        <span className="block font-mono text-[11px] text-zinc-400">{invoice.invoice_number}</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-zinc-500">{invoice.client_phone || "-"}</td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-red-500">
                        +{invoice.days_overdue}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold tabular-nums whitespace-nowrap text-zinc-900 dark:text-white">
                      {format.money(dueAmount)}
                    </td>
                    <td className="p-4">
                      {invoice.last_reminder_at ? (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <History className="h-3 w-3" />
                          <span>
                            {format.date(invoice.last_reminder_at)} ({invoice.reminder_count})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400">{t("never")}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleSendReminder(invoice)}
                        disabled={(isPending && sendingId === invoice.id) || !invoice.client_phone}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#128C7E] disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isPending && sendingId === invoice.id ? (
                          t("sending")
                        ) : (
                          <>
                            <MessageCircle className="h-4 w-4" /> {t("send")}
                          </>
                        )}
                      </button>
                      {failure?.id === invoice.id && (
                        <p className="mt-1 text-[11px] text-red-500">{tFeedback(failure.code)}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <p>{t("no_invoices")}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

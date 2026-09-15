"use client";

import { useTransition, useState } from "react";
import { MessageCircle, CheckCircle2, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { sendReminder, type OverdueInvoice } from "../actions";

export type { OverdueInvoice };

export default function ReminderList({
  invoices,
}: {
  invoices: OverdueInvoice[];
}) {
  const t = useTranslations("Reminders");
  const [isPending, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const handleSendReminder = (invoice: OverdueInvoice) => {
    setSendingId(invoice.id);
    setErrorId(null);

    // Open a blank tab synchronously, inside the click handler, so browsers
    // don't treat the later navigation (after the server round-trip below)
    // as a blocked popup — only the initial window.open() call counts as
    // being "in response to a user gesture".
    const pendingTab = window.open("", "_blank");

    startTransition(async () => {
      const dueAmount = invoice.total_amount - invoice.paid_amount;
      const result = await sendReminder({
        id: invoice.id,
        client_id: invoice.client_id,
        client_name: invoice.client_name,
        client_phone: invoice.client_phone,
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
      });
      setSendingId(null);

      if (result.error) {
        pendingTab?.close();
        setErrorId(invoice.id);
        return;
      }

      if (result.whatsappUrl) {
        if (pendingTab) {
          pendingTab.location.href = result.whatsappUrl;
        } else {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
        }
        alert(t("manual_alert", { name: invoice.client_name, amount: dueAmount }));
      } else {
        pendingTab?.close();
        alert(t("success_alert", { name: invoice.client_name, amount: dueAmount }));
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("eligible_invoices")}</h2>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
              <tr>
                <th className="p-4 font-medium">{t("client")}</th>
                <th className="p-4 font-medium">{t("phone")}</th>
                <th className="p-4 font-medium">{t("overdue_days")}</th>
                <th className="p-4 font-medium text-right">{t("remaining_due")}</th>
                <th className="p-4 font-medium">{t("last_reminder")}</th>
                <th className="p-4 font-medium text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((invoice) => {
                const dueAmount = invoice.total_amount - invoice.paid_amount;
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="p-4">
                      <span className="font-medium">{invoice.client_name}</span>
                      {invoice.invoice_number && (
                        <span className="block text-xs text-zinc-400">{invoice.invoice_number}</span>
                      )}
                    </td>
                    <td className="p-4">{invoice.client_phone || "-"}</td>
                    <td className="p-4">
                      <span className="font-bold text-red-600 dark:text-red-400">
                        +{invoice.days_overdue}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold">
                      {dueAmount.toLocaleString("fr-FR")} FCFA
                    </td>
                    <td className="p-4">
                      {invoice.last_reminder_at ? (
                        <div className="flex items-center gap-2 text-zinc-500">
                          <History className="h-3 w-3" />
                          <span>
                            {new Date(invoice.last_reminder_at).toLocaleDateString()} ({invoice.reminder_count})
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">{t("never")}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleSendReminder(invoice)}
                        disabled={(isPending && sendingId === invoice.id) || !invoice.client_phone}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
                      >
                        {isPending && sendingId === invoice.id ? (
                          t("sending")
                        ) : (
                          <>
                            <MessageCircle className="h-4 w-4" /> {t("send")}
                          </>
                        )}
                      </button>
                      {errorId === invoice.id && (
                        <p className="mt-1 text-xs text-red-500">{t("send_error")}</p>
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

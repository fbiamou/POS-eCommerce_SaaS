"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { FileText } from "lucide-react";
import type { InvoiceListItem } from "../actions";

export default function InvoiceList({
  invoices,
  currencySymbol,
}: {
  invoices: InvoiceListItem[];
  currencySymbol: string;
}) {
  const t = useTranslations("Invoices");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(
      (inv) =>
        (inv.invoice_number ?? "").toLowerCase().includes(term) ||
        (inv.client_name ?? "").toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  const statusLabel = {
    PAID: t("status_paid"),
    PARTIAL: t("status_partial"),
    UNPAID: t("status_unpaid"),
  };

  const statusClass = {
    PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const format = (n: number) => `${n.toLocaleString("fr-FR")} ${currencySymbol}`;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder={t("search")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full max-w-sm rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
              <tr>
                <th className="p-4 font-medium">{t("invoice_number")}</th>
                <th className="p-4 font-medium">{t("client")}</th>
                <th className="p-4 font-medium">{t("date")}</th>
                <th className="p-4 font-medium text-right">{t("total_ttc")}</th>
                <th className="p-4 font-medium text-right">{t("remaining_due")}</th>
                <th className="p-4 font-medium">{t("status")}</th>
                <th className="p-4 font-medium text-right">{t("view")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((invoice) => {
                const remaining = invoice.total_amount - invoice.paid_amount;
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="p-4 font-medium">{invoice.invoice_number || "—"}</td>
                    <td className="p-4">{invoice.client_name || t("walk_in_client")}</td>
                    <td className="p-4">{new Date(invoice.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-4 text-right font-bold">{format(invoice.total_amount)}</td>
                    <td className="p-4 text-right">{remaining > 0 ? format(remaining) : "—"}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[invoice.status]}`}>
                        {statusLabel[invoice.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        <FileText className="h-3.5 w-3.5" /> {t("view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    {invoices.length === 0 ? t("no_invoices") : t("no_results")}
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

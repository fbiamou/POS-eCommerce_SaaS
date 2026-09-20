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

  const format = (n: number) => `${n.toLocaleString("fr-FR")}`;

  return (
    <div className="flex flex-col gap-5">
      <input
        type="text"
        placeholder={t("search")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400"
      />

      <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] min-w-[800px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-[#2d2936]">
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("invoice_number")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("client")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("date")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("total_ttc")} ({currencySymbol})</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("remaining_due")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("status")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("view")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
              {filtered.map((invoice) => {
                const remaining = invoice.total_amount - invoice.paid_amount;
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 font-mono font-medium text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400">{invoice.invoice_number || "—"}</td>
                    <td className="p-4 font-bold text-zinc-900 dark:text-white">{invoice.client_name || t("walk_in_client")}</td>
                    <td className="p-4 text-zinc-500">{new Date(invoice.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-4 text-right font-mono font-bold text-zinc-900 dark:text-white tabular-nums">{format(invoice.total_amount)}</td>
                    <td className="p-4 text-right font-mono font-bold text-red-500 tabular-nums">{remaining > 0 ? format(remaining) : "—"}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[invoice.status]}`}>
                        {statusLabel[invoice.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-zinc-100 text-zinc-600 hover:bg-violet-600 hover:text-white dark:bg-[#2d2936] dark:text-zinc-300 dark:hover:bg-violet-600 transition-colors"
                        title={t("view")}
                      >
                        <FileText className="h-4 w-4" />
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

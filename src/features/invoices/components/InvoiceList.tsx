"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ChevronRight, CloudOff, Search, TriangleAlert } from "lucide-react";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useLocalInvoices } from "@/features/offline/hooks";
import type { LocalState } from "@/features/offline/db";
import type { InvoiceListItem } from "../actions";
import { INVOICE_STATUS_CLASS } from "../status";

type Filter = "all" | "due" | "paid";

export default function InvoiceList({ invoices: serverInvoices }: { invoices: InvoiceListItem[] }) {
  const t = useTranslations("Invoices");
  const tOffline = useTranslations("Offline");
  // The device's copy when it has one: it also lists the sales made offline.
  const localInvoices = useLocalInvoices();
  const invoices: (InvoiceListItem & { local_state?: LocalState })[] = useMemo(
    () =>
      localInvoices
        ? localInvoices.map((inv) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            total_amount: inv.total_amount,
            paid_amount: inv.paid_amount,
            status: inv.status,
            created_at: inv.created_at,
            client_name: inv.client_name,
            local_state: inv.local_state,
          }))
        : serverInvoices,
    [localInvoices, serverInvoices]
  );
  const format = useShopFormat();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // A sale the server refused is not owed: it stays listed, apart.
  const counted = invoices.filter((inv) => inv.local_state !== "failed");
  const dueCount = counted.filter((inv) => inv.status !== "PAID").length;
  const paidCount = counted.length - dueCount;
  const totalDue = counted.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter === "due" && inv.status === "PAID") return false;
      if (filter === "paid" && inv.status !== "PAID") return false;
      if (!term) return true;
      return (
        (inv.invoice_number ?? "").toLowerCase().includes(term) ||
        (inv.client_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [invoices, searchTerm, filter]);

  const statusLabel = {
    PAID: t("status_paid"),
    PARTIAL: t("status_partial"),
    UNPAID: t("status_unpaid"),
  };

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-night text-white dark:bg-violet-500"
        : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {totalDue > 0 && (
        <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <span className="text-[13px] font-semibold text-zinc-500">{t("summary_due")}</span>
          <span className="font-mono text-xl font-semibold tabular-nums text-red-700 dark:text-red-400">{format.money(totalDue)}</span>
        </div>
      )}

      <div className="relative">
        <label htmlFor="invoice-search" className="sr-only">{t("search")}</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
        <input
          id="invoice-search"
          type="search"
          placeholder={t("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-12 w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] pl-11 pr-4 text-[15px] font-medium transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => setFilter("all")} className={chipClass(filter === "all")}>
          {t("filter_all")} <span className="ml-1 font-mono tabular-nums opacity-70">{invoices.length}</span>
        </button>
        <button type="button" onClick={() => setFilter("due")} className={chipClass(filter === "due")}>
          {t("filter_due")} <span className="ml-1 font-mono tabular-nums opacity-70">{dueCount}</span>
        </button>
        <button type="button" onClick={() => setFilter("paid")} className={chipClass(filter === "paid")}>
          {t("filter_paid")} <span className="ml-1 font-mono tabular-nums opacity-70">{paidCount}</span>
        </button>
      </div>

      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
        {filtered.map((invoice) => {
          const remaining = invoice.total_amount - invoice.paid_amount;
          return (
            <li key={invoice.id}>
              <Link
                href={`/invoices/${invoice.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-[var(--surface-2)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-zinc-900 dark:text-white">
                      {invoice.client_name || t("walk_in_client")}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVOICE_STATUS_CLASS[invoice.status]}`}>
                      {statusLabel[invoice.status]}
                    </span>
                    {invoice.local_state === "pending" && (
                      <span title={tOffline("badge_pending")} className="shrink-0 text-amber-700 dark:text-amber-300">
                        <CloudOff className="h-3.5 w-3.5" />
                        <span className="sr-only">{tOffline("badge_pending")}</span>
                      </span>
                    )}
                    {invoice.local_state === "failed" && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        <TriangleAlert className="h-3 w-3" /> {tOffline("badge_failed")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[12px] text-zinc-500">
                    {invoice.invoice_number || "—"} · {format.date(invoice.created_at)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-[14px] font-semibold tabular-nums">{format.money(invoice.total_amount)}</span>
                  {remaining > 0 && (
                    <span className="font-mono text-[12px] font-semibold tabular-nums text-red-700 dark:text-red-400">
                      {t("remaining_short", { amount: format.money(remaining) })}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-zinc-500">
            {invoices.length === 0 ? t("no_invoices") : t("no_results")}
          </li>
        )}
      </ul>
    </div>
  );
}

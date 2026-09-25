"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useLocalClients, useLocalInvoices } from "@/features/offline/hooks";
import type { LocalInvoice } from "@/features/offline/db";
import { loyaltyCard } from "../loyalty";
import { computeClientStats, isLoyalClient, LOYALTY_MIN_PURCHASES, LOYALTY_WINDOW_DAYS } from "../stats";
import ClientList, { type ClientData } from "./ClientList";

// The customers page: totals and list. With offline mode, the figures come
// from the device's copy of the shop (customers and their invoices), with
// the same rules as the server (clients/stats, clients/loyalty); a sale made
// offline counts at once. Until the device has its copy, the server's.
export function ClientsView({
  serverClients,
  defaultPhoneCountryCode,
  loyaltyEnabled,
  stampsRequired,
}: {
  serverClients: ClientData[];
  defaultPhoneCountryCode: string;
  loyaltyEnabled: boolean;
  stampsRequired: number;
}) {
  const t = useTranslations("Clients");
  const format = useShopFormat();
  const localClients = useLocalClients();
  const localInvoices = useLocalInvoices();

  const clients: ClientData[] = useMemo(() => {
    if (!localClients || !localInvoices) return serverClients;
    const byClient = new Map<string, LocalInvoice[]>();
    for (const invoice of localInvoices) {
      // A sale the server refused is not a purchase nor a debt.
      if (!invoice.client_id || invoice.local_state === "failed") continue;
      const list = byClient.get(invoice.client_id) ?? [];
      list.push(invoice);
      byClient.set(invoice.client_id, list);
    }
    return localClients
      .filter((c) => c.local_state !== "failed")
      .map((c) => {
        const invoices = byClient.get(c.id) ?? [];
        const stats = computeClientStats(invoices);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          ...stats,
          is_loyal: isLoyalClient(stats),
          card: loyaltyCard(invoices, stampsRequired, loyaltyEnabled),
        };
      });
  }, [localClients, localInvoices, serverClients, stampsRequired, loyaltyEnabled]);

  const totalDebt = clients.reduce((s, c) => s + c.total_debt, 0);
  const debtorCount = clients.filter((c) => c.total_debt > 0).length;
  const loyalCount = clients.filter((c) => c.is_loyal).length;

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card lg:col-span-1">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("total_debts")}</dt>
          <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${totalDebt > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{format.money(totalDebt)}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("debtors")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{debtorCount}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("total_clients")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{clients.length}</dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card lg:col-span-1">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("loyal_clients")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{loyalCount}</dd>
          <p className="mt-1 text-[12px] text-zinc-500">{t("loyal_rule", { count: LOYALTY_MIN_PURCHASES, days: LOYALTY_WINDOW_DAYS })}</p>
        </div>
      </dl>

      <ClientList clients={clients} defaultPhoneCountryCode={defaultPhoneCountryCode} loyaltyEnabled={loyaltyEnabled} />
    </>
  );
}

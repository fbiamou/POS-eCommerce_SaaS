import ClientList from "@/features/clients/components/ClientList";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { loyaltyCard, type LoyaltyInvoice } from "@/features/clients/loyalty";
import { computeClientStats, isLoyalClient, LOYALTY_MIN_PURCHASES, LOYALTY_WINDOW_DAYS, type ClientInvoice } from "@/features/clients/stats";

export async function generateMetadata() {
  const t = await getTranslations("Clients");
  return { title: t("title") };
}

export default async function ClientsPage() {
  const [t, supabase, shopSettings, format] = await Promise.all([
    getTranslations("Clients"),
    createClient(),
    getShopSettings(),
    getFormatters(),
  ]);

  // Fetch clients with aggregated invoice data
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      phone,
      created_at,
      invoices(total_amount, paid_amount, status, created_at, loyalty_reward_used)
    `)
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Compute stats per client
  const clients = (clientsRaw ?? []).map((c) => {
    const stats = computeClientStats((c.invoices ?? []) as ClientInvoice[]);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone as string | null,
      ...stats,
      is_loyal: isLoyalClient(stats),
      card: loyaltyCard(
        (c.invoices ?? []) as LoyaltyInvoice[],
        shopSettings?.loyalty_stamps_required ?? 10,
        shopSettings?.loyalty_enabled ?? true
      ),
    };
  });

  const totalDebt = clients.reduce((s, c) => s + c.total_debt, 0);

  const debtorCount = clients.filter((c) => c.total_debt > 0).length;
  const loyalCount = clients.filter((c) => c.is_loyal).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>

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

      <ClientList
        clients={clients}
        defaultPhoneCountryCode={shopSettings?.default_phone_country_code || "+237"}
        loyaltyEnabled={shopSettings?.loyalty_enabled ?? true}
      />
    </div>
  );
}

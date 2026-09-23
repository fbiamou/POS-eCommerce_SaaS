import ClientList from "@/features/clients/components/ClientList";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { computeClientStats, isLoyalClient, type ClientInvoice } from "@/features/clients/stats";

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
      invoices(total_amount, paid_amount, status, created_at)
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
    };
  });

  const totalDebt = clients.reduce((s, c) => s + c.total_debt, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/50 dark:bg-red-900/10">
          <div className="text-sm font-medium text-red-800 dark:text-red-400">
            {t("total_debts")}
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-500">
            {format.money(totalDebt)}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-zinc-500">{t("total_clients")}</div>
          <div className="mt-2 text-2xl font-bold">{clients.length}</div>
        </div>
      </div>

      <ClientList clients={clients} defaultPhoneCountryCode={shopSettings?.default_phone_country_code || "+237"} />
    </div>
  );
}

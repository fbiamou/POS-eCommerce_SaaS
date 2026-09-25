import { ClientsView } from "@/features/clients/components/ClientsView";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getShopSettings } from "@/features/settings/queries";
import { loyaltyCard, type LoyaltyInvoice } from "@/features/clients/loyalty";
import { computeClientStats, isLoyalClient, type ClientInvoice } from "@/features/clients/stats";

export async function generateMetadata() {
  const t = await getTranslations("Clients");
  return { title: t("title") };
}

export default async function ClientsPage() {
  const [t, supabase, shopSettings] = await Promise.all([
    getTranslations("Clients"),
    createClient(),
    getShopSettings(),
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>

      <ClientsView
        serverClients={clients}
        defaultPhoneCountryCode={shopSettings?.default_phone_country_code || "+237"}
        loyaltyEnabled={shopSettings?.loyalty_enabled ?? true}
        stampsRequired={shopSettings?.loyalty_stamps_required ?? 10}
      />
    </div>
  );
}

import ClientList from "@/features/clients/components/ClientList";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";

export default async function ClientsPage() {
  const t = await getTranslations("Clients");
  const supabase = await createClient();

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
    const invoices: any[] = (c.invoices as any[]) ?? [];
    const total_purchases = invoices.length;
    const total_spent = invoices.reduce((s, inv) => s + inv.total_amount, 0);
    const total_debt = invoices.reduce(
      (s, inv) => s + Math.max(0, inv.total_amount - inv.paid_amount),
      0
    );
    // Oldest invoice date = first purchase date
    const dates = invoices
      .map((inv) => inv.created_at)
      .filter(Boolean)
      .sort();
    const first_purchase_date = dates[0] ?? c.created_at;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      total_purchases,
      total_spent,
      total_debt,
      first_purchase_date,
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
            {totalDebt.toLocaleString("fr-FR")} FCFA
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-zinc-500">{t("total_clients")}</div>
          <div className="mt-2 text-2xl font-bold">{clients.length}</div>
        </div>
      </div>

      <ClientList clients={clients} />
    </div>
  );
}

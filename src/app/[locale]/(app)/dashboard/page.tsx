import { Link, redirect } from "@/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { isPageAllowed, firstAllowedPath } from "@/lib/appPages";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const locale = await getLocale();
  const supabase = await createClient();

  const profile = await getCurrentProfile();
  if (profile && !isPageAllowed(profile.role, profile.allowed_pages, "/dashboard")) {
    redirect(firstAllowedPath(profile.allowed_pages) as any);
  }

  // Fetch today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // KPI: Today's revenue + sales count
  const { data: todayInvoices } = await supabase
    .from("invoices")
    .select("total_amount, paid_amount")
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  const todayCA = todayInvoices?.reduce((sum, inv) => sum + inv.total_amount, 0) ?? 0;
  const salesCount = todayInvoices?.length ?? 0;

  // KPI: Total outstanding debt
  const { data: debtData } = await supabase
    .from("invoices")
    .select("total_amount, paid_amount")
    .in("status", ["UNPAID", "PARTIAL"]);
  const totalDebt =
    debtData?.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0) ?? 0;

  // KPI: Low stock count (quantity <= 3)
  const { count: lowStockCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .lte("quantity_in_stock", 3)
    .eq("is_active", true);

  // Recent Invoices
  const { data: recentInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, status, client_id, clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(3);

  // First unpaid invoice for quick reminder
  const firstUnpaid = recentInvoices?.find((inv) => inv.status === "PARTIAL" || inv.status === "UNPAID");

  // Top Articles (Today)
  const { data: topSalesData } = await supabase
    .from("invoice_items")
    .select("product_id, quantity, products(name)")
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  const productSales = new Map<string, { name: string, quantity: number }>();
  topSalesData?.forEach((item) => {
    const pId = item.product_id;
    const qty = item.quantity;
    const name = (item.products as any)?.name || "Produit inconnu";
    if (productSales.has(pId)) {
      productSales.get(pId)!.quantity += qty;
    } else {
      productSales.set(pId, { name, quantity: qty });
    }
  });

  const topArticles = Array.from(productSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "PARTIAL":
        return "bg-[#FFF3CD] text-[#856404] dark:bg-[#FBBF24]/20 dark:text-[#FBBF24]";
      case "UNPAID":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PAID": return "Payée";
      case "PARTIAL": return "Partielle";
      case "UNPAID": return "Impayée";
      default: return status;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        {firstName && (
          <p className="mt-1 text-sm text-[#7A7488] dark:text-[#A79FB0]">
            {t("greeting", { name: firstName, date: today })}
          </p>
        )}
      </div>

      {/* KPI Cards - Dense, 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        
        {/* CA du jour */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("today_ca")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-zinc-900 dark:text-white leading-tight tabular-nums">
            {todayCA.toLocaleString("fr-FR")} <br className="sm:hidden" />FCFA
          </span>
        </div>

        {/* Ventes */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("sales_count")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-zinc-900 dark:text-white leading-tight tabular-nums">
            {salesCount}
          </span>
        </div>

        {/* Dettes */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("debts")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-[#F87171] leading-tight tabular-nums">
            {totalDebt.toLocaleString("fr-FR")} <br className="sm:hidden" />FCFA
          </span>
        </div>

        {/* Stock bas */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("low_stock")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-[#FBBF24] leading-tight tabular-nums">
            {lowStockCount ?? 0} <br className="sm:hidden" /><span className="font-sans text-sm sm:text-base font-medium">articles</span>
          </span>
        </div>

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Factures Récentes */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-5 sm:p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mb-4">Factures récentes</h2>
          
          <div className="flex flex-col gap-4">
            {recentInvoices?.map((inv) => {
              const clientName = (inv.clients as any)?.full_name || "Client de passage";
              return (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {clientName}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      {inv.invoice_number}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                      {inv.total_amount.toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </div>
                </Link>
              );
            })}

            {recentInvoices?.length === 0 && (
              <p className="text-sm text-zinc-500">Aucune facture récente.</p>
            )}
          </div>
        </div>

        {/* Colonne de droite: Actions Rapides + Top Articles */}
        <div className="flex flex-col gap-4">
          
          {/* Actions Rapides */}
          <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-5 sm:p-6 shadow-sm">
            <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mb-4">{t("quick_actions") || "Actions rapides"}</h2>
            {firstUnpaid ? (
              <Link 
                href="/reminders"
                className="flex w-full items-center justify-center rounded-xl bg-[#10B981] px-4 py-3 text-sm font-bold text-white hover:bg-[#059669] transition-colors shadow-sm"
              >
                Relancer {(firstUnpaid.clients as any)?.full_name?.split(" ")[0] || "Client"} — WhatsApp
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">Aucune action urgente.</p>
            )}
          </div>

          {/* Top Articles */}
          <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-5 sm:p-6 shadow-sm flex-1">
            <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mb-4">{t("top_sales") || "Articles les plus vendus"}</h2>
            
            <div className="flex flex-col gap-3">
              {topArticles.map((article, index) => (
                <div key={index} className="flex items-center justify-between border-b border-zinc-50 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate pr-4">
                    {article.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 shrink-0 tabular-nums">
                    {article.quantity} {t("sold") || "vendus"}
                  </span>
                </div>
              ))}
              {topArticles.length === 0 && (
                <p className="text-sm text-zinc-500">Aucune vente aujourd'hui.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

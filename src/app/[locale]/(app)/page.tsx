import { Package, TrendingUp, Users, DollarSign } from "lucide-react";
import { Link, redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { isPageAllowed, firstAllowedPath } from "@/lib/appPages";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();

  // Server actions' redirect() after login lands here via a client-side
  // transition that skips the edge middleware, so a restricted employee
  // without dashboard access would otherwise briefly see it — guard here too.
  const profile = await getCurrentProfile();
  if (profile && !isPageAllowed(profile.role, profile.allowed_pages, "/")) {
    // firstAllowedPath always returns one of the known routes in APP_PAGES,
    // but that list is a plain string[] so it doesn't match next-intl's
    // generated pathname union type.
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

  // Top selling products today
  const { data: topItems } = await supabase
    .from("invoice_items")
    .select("quantity, total_price, product_id, products(name)")
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString())
    .order("quantity", { ascending: false })
    .limit(10);

  // Group by product
  const productMap = new Map<string, { name: string; qty: number; total: number }>();
  for (const item of topItems ?? []) {
    const name = (item.products as any)?.name ?? "Produit inconnu";
    const existing = productMap.get(item.product_id) ?? { name, qty: 0, total: 0 };
    productMap.set(item.product_id, {
      name,
      qty: existing.qty + item.quantity,
      total: existing.total + item.total_price,
    });
  }
  const topProducts = Array.from(productMap.values()).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-sm font-medium text-zinc-500">{t("today_ca")}</span>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold tabular-nums">
            {todayCA.toLocaleString("fr-FR")} FCFA
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-zinc-500">{t("sales_count")}</span>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold tabular-nums">{salesCount}</div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm font-medium text-zinc-500">{t("debts")}</span>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold tabular-nums text-red-500">
            {totalDebt.toLocaleString("fr-FR")} FCFA
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-sm font-medium text-zinc-500">{t("low_stock")}</span>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold tabular-nums text-orange-500">
            {lowStockCount ?? 0}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Articles */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-4">{t("top_sales")}</h2>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune vente aujourd&apos;hui.</p>
            ) : (
              topProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-xs text-zinc-500">
                      {p.qty} {t("sold")}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {p.total.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-4">{t("quick_actions")}</h2>
          <div className="flex flex-col gap-3">
            <Link
              href="/sales"
              className="flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
            >
              {t("new_sale")}
            </Link>
            <Link
              href="/stock"
              className="flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {t("view_stock")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

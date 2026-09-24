import { Link, redirect } from "@/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { getFormatters } from "@/features/settings/queries";
import { isPageAllowed, firstAllowedPath } from "@/lib/appPages";
import { dayRangeInTimeZone } from "@/lib/format";
import { rankTopProducts, TOP_SALES_PERIODS, type TopSalesPeriod } from "@/features/sales/stats";

export async function generateMetadata() {
  const t = await getTranslations("Dashboard");
  return { title: t("title") };
}

type InvoiceWithClient = {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  clients: { name: string } | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [t, locale, format, profile, supabase, params] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
    getFormatters(),
    getCurrentProfile(),
    createClient(),
    searchParams,
  ]);

  if (profile && !isPageAllowed(profile.role, profile.allowed_pages, "/dashboard")) {
    redirect({ href: firstAllowedPath(profile.allowed_pages), locale });
  }

  const period: TopSalesPeriod = TOP_SALES_PERIODS.includes(params.period as TopSalesPeriod)
    ? (params.period as TopSalesPeriod)
    : "day";

  // "Today" is the shop's calendar day, not the server's (UTC).
  const now = new Date();
  const today = dayRangeInTimeZone(now, format.timeZone);
  const periodDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const periodStart = new Date(today.start.getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000);

  const [todayInvoicesRes, debtRes, lowStockRes, recentRes, oldestDebtRes, soldItemsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount")
      .gte("created_at", today.start.toISOString())
      .lt("created_at", today.end.toISOString()),
    supabase.from("invoices").select("total_amount, paid_amount").in("status", ["UNPAID", "PARTIAL"]),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .lte("quantity_in_stock", format.lowStockThreshold)
      .eq("is_active", true),
    supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, status, clients(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    // The oldest unpaid invoice with a client is the most urgent reminder.
    supabase
      .from("invoices")
      .select("id, clients!inner(name)")
      .in("status", ["UNPAID", "PARTIAL"])
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("invoice_items")
      .select("product_id, quantity, products(name)")
      .gte("created_at", periodStart.toISOString())
      .lt("created_at", today.end.toISOString()),
  ]);

  for (const res of [todayInvoicesRes, debtRes, lowStockRes, recentRes, oldestDebtRes, soldItemsRes]) {
    if (res.error) console.error("Dashboard query failed:", res.error);
  }

  const todayRevenue = (todayInvoicesRes.data ?? []).reduce((sum, inv) => sum + inv.total_amount, 0);
  const salesCount = todayInvoicesRes.data?.length ?? 0;
  const totalDebt = (debtRes.data ?? []).reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
  const lowStockCount = lowStockRes.count ?? 0;
  const recentInvoices = (recentRes.data ?? []) as unknown as InvoiceWithClient[];
  const oldestDebt = oldestDebtRes.data?.[0] as unknown as { id: string; clients: { name: string } } | undefined;
  const topArticles = rankTopProducts(
    (soldItemsRes.data ?? []) as unknown as { product_id: string; quantity: number; products: { name: string } | null }[],
    t("unknown_product"),
    5
  );

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

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
      case "PAID": return t("paid");
      case "PARTIAL": return t("partial");
      case "UNPAID": return t("unpaid");
      default: return status;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        {firstName && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("greeting", { name: firstName, date: format.date(now, "weekday") })}
          </p>
        )}
      </div>

      {/* KPI Cards - Dense, 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("today_ca")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-zinc-900 dark:text-white leading-tight tabular-nums">
            {format.money(todayRevenue)}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("sales_count")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-zinc-900 dark:text-white leading-tight tabular-nums">
            {salesCount}
          </span>
        </div>

        <Link href="/clients" className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("debts")}</span>
          <span className="mt-2 font-mono text-[17px] sm:text-xl font-bold text-red-600 dark:text-red-400 leading-tight tabular-nums">
            {format.money(totalDebt)}
          </span>
        </Link>

        <Link href="/stock" className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("low_stock")}</span>
          <span className="mt-2 text-[17px] sm:text-xl font-bold text-amber-700 dark:text-amber-400 leading-tight tabular-nums">
            {t("articles_count", { count: lowStockCount })}
          </span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-5 sm:p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-4">{t("recent_invoices")}</h2>

          <div className="flex flex-col gap-4">
            {recentInvoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 group">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {inv.clients?.name || t("walk_in_client")}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 mt-0.5">{inv.invoice_number}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                    {format.money(inv.total_amount)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(inv.status)}`}>
                    {getStatusLabel(inv.status)}
                  </span>
                </div>
              </Link>
            ))}

            {recentInvoices.length === 0 && <p className="text-sm text-zinc-500">{t("no_recent_invoices")}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-5 sm:p-6 shadow-sm">
            <h2 className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-4">{t("quick_actions")}</h2>
            {oldestDebt ? (
              <Link
                href="/reminders"
                className="flex w-full items-center justify-center rounded-xl bg-[#047857] px-4 py-3 text-sm font-bold text-white hover:bg-[#065f46] transition-colors shadow-sm"
              >
                {t("remind_client", { name: oldestDebt.clients.name.split(" ")[0] })}
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">{t("no_urgent_action")}</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-5 sm:p-6 shadow-sm flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase">{t("top_sales")}</h2>
              <nav className="flex gap-1" aria-label={t("top_sales")}>
                {TOP_SALES_PERIODS.map((p) => (
                  <Link
                    key={p}
                    href={{ pathname: "/dashboard", query: { period: p } }}
                    aria-current={p === period ? "page" : undefined}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      p === period
                        ? "bg-violet-600 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {t(`period_${p}`)}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex flex-col gap-3">
              {topArticles.map((article) => (
                <div key={article.productId} className="flex items-center justify-between border-b border-zinc-50 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate pr-4">{article.name}</span>
                  <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 shrink-0 tabular-nums">
                    {t("sold_count", { count: article.quantity })}
                  </span>
                </div>
              ))}
              {topArticles.length === 0 && <p className="text-sm text-zinc-500">{t(`no_sales_${period}`)}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

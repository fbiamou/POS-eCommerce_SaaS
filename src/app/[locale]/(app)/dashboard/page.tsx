import { Link, redirect } from "@/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { firstSteps, showFirstSteps } from "@/features/onboarding/steps";
import { FirstSteps } from "@/features/onboarding/components/FirstSteps";
import { getOverdueInvoices } from "@/features/reminders/actions";
import { getShopAccess } from "@/features/billing/access";
import { planAllows } from "@/features/billing/plans";
import { isPageAllowed, firstAllowedPath } from "@/lib/appPages";
import { dayRangeInTimeZone } from "@/lib/format";
import { rankTopProducts, TOP_SALES_PERIODS, type TopSalesPeriod } from "@/features/sales/stats";
import { DashboardBody } from "@/features/dashboard/components/DashboardBody";

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
  const [t, locale, format, profile, supabase, params, shopSettings] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
    getFormatters(),
    getCurrentProfile(),
    createClient(),
    searchParams,
    getShopSettings(),
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

  const access = await getShopAccess();
  const [todayInvoicesRes, debtRes, lowStockRes, recentRes, soldItemsRes, dueReminders] = await Promise.all([
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
    supabase
      .from("invoice_items")
      .select("product_id, quantity, products(name)")
      .gte("created_at", periodStart.toISOString())
      .lt("created_at", today.end.toISOString()),
    getOverdueInvoices(),
  ]);

  for (const res of [todayInvoicesRes, debtRes, lowStockRes, recentRes, soldItemsRes]) {
    if (res.error) console.error("Dashboard query failed:", res.error);
  }

  // First steps guide, for the owner of a shop that is still being set up.
  let steps = null;
  if (profile?.role === "MANAGER") {
    const [productsRes, invoicesRes, teamRes] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("invoices").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    const all = firstSteps({
      shopDetailsFilled: Boolean(shopSettings?.country_code && (shopSettings.shop_phone || shopSettings.shop_logo_url)),
      productCount: productsRes.count ?? 0,
      invoiceCount: invoicesRes.count ?? 0,
      storefrontAddress: Boolean(shopSettings?.shop_slug),
      teamSize: teamRes.count ?? 1,
      storefrontIncluded: planAllows(access.plan, "storefront"),
    });
    if (showFirstSteps(all)) steps = all;
  }

  const todayRevenue = (todayInvoicesRes.data ?? []).reduce((sum, inv) => sum + inv.total_amount, 0);
  const salesCount = todayInvoicesRes.data?.length ?? 0;
  const totalDebt = (debtRes.data ?? []).reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
  const lowStockCount = lowStockRes.count ?? 0;
  const recentInvoices = (recentRes.data ?? []) as unknown as InvoiceWithClient[];
  // The same list as the Reminders page (first delay, then the recurring
  // delay since the last reminder): the button only offers a reminder that
  // is actually due, the most overdue first.
  // Reminders come with the Essentiel plan: below it, no reminder button.
  const nextReminder = planAllows(access.plan, "reminders")
    ? [...dueReminders].sort((a, b) => b.days_overdue - a.days_overdue)[0]
    : undefined;
  const topArticles = rankTopProducts(
    (soldItemsRes.data ?? []) as unknown as { product_id: string; quantity: number; products: { name: string } | null }[],
    t("unknown_product"),
    5
  );

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

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

      {steps && <FirstSteps steps={steps} />}

      <DashboardBody
        serverPeriod={period}
        server={{
          todayRevenue,
          salesCount,
          totalDebt,
          lowStockCount,
          recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            client_name: inv.clients?.name ?? null,
            total_amount: inv.total_amount,
            status: inv.status,
          })),
          topArticles,
        }}
        quickActions={
          <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] p-5 sm:p-6 shadow-sm">
            <h2 className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-4">{t("quick_actions")}</h2>
            {nextReminder ? (
              <Link
                href="/reminders"
                className="flex w-full items-center justify-center rounded-xl bg-[#047857] px-4 py-3 text-sm font-bold text-white hover:bg-[#065f46] transition-colors shadow-sm"
              >
                {dueReminders.length > 1
                  ? t("remind_many", { count: dueReminders.length })
                  : t("remind_client", { name: nextReminder.client_name.split(" ")[0] })}
              </Link>
            ) : totalDebt > 0 && planAllows(access.plan, "reminders") ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-500">{t("no_reminder_due")}</p>
                <Link href="/reminders" className="text-sm font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300">
                  {t("see_reminders")}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{t("no_urgent_action")}</p>
            )}
          </div>
        }
      />
    </div>
  );
}

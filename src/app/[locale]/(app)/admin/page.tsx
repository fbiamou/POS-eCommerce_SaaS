import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Flag } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getFormatters } from "@/features/settings/queries";
import { isPlatformAdmin, listReports, listShops } from "@/features/admin/queries";
import { effectivePlan } from "@/features/billing/plans";
import { PLAN_BADGE_CLASS, countryName } from "@/features/admin/components/planStyle";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

// The WISHOP console: every shop on the platform, its plan and its activity.
// Reserved to platform admins; anyone else gets a 404.
export default async function AdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const [t, locale, format, shops, reports] = await Promise.all([
    getTranslations("Admin"),
    getLocale(),
    getFormatters(),
    listShops(),
    listReports(),
  ]);

  const now = new Date();
  const paying = shops.filter((shop) => effectivePlan(shop, now) !== "STANDARD").length;
  const suspended = shops.filter((shop) => shop.suspended_at).length;
  const newReports = reports.filter((report) => report.status === "NEW").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-[14px] text-zinc-500">{t("subtitle")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("shops")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{shops.length}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("paid_plans")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{paying}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("suspended_shops")}</dt>
          <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${suspended > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{suspended}</dd>
        </div>
        <div className="relative rounded-2xl bg-[var(--surface-1)] p-4 shadow-card hover:bg-zinc-50 dark:hover:bg-white/5">
          <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500">
            <Flag className="h-3.5 w-3.5" />
            <Link href="/admin/reports" className="after:absolute after:inset-0">
              {t("reports")}
            </Link>
          </dt>
          <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${newReports > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {newReports}
            <span className="ml-1.5 font-sans text-[12px] font-semibold text-zinc-500">{t("new_reports")}</span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="admin-shops" className="flex flex-col gap-3">
        <h2 id="admin-shops" className="text-lg font-bold">{t("shops")}</h2>
        {shops.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-1)] p-8 text-center text-[14px] text-zinc-500 shadow-card">{t("no_shops")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {shops.map((shop) => {
              const plan = effectivePlan(shop, now);
              const expired = shop.plan !== "STANDARD" && plan === "STANDARD";
              return (
                <li key={shop.shop_id}>
                  <Link
                    href={`/admin/shops/${shop.shop_id}`}
                    className="flex items-center gap-3 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{shop.shop_name || t("unnamed_shop")}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PLAN_BADGE_CLASS[plan]}`}>{t(`plan_${plan}`)}</span>
                        {shop.suspended_at && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {t("suspended_badge")}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[13px] text-zinc-500">
                        {[shop.owner_name, shop.owner_email, countryName(shop.country_code, locale)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        {t("activity", { products: shop.product_count, invoices: shop.invoice_count, members: shop.member_count })}
                        {shop.last_sale_at && ` · ${t("last_sale", { date: format.date(shop.last_sale_at) })}`}
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        {shop.signed_up_at && t("signed_up", { date: format.date(shop.signed_up_at) })}
                        {plan !== "STANDARD" && shop.paid_until && ` · ${t("until", { date: format.date(shop.paid_until) })}`}
                        {expired && shop.paid_until && ` · ${t("expired_on", { plan: t(`plan_${shop.plan}`), date: format.date(shop.paid_until) })}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

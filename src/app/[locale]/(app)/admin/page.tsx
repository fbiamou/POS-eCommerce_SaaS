import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Flag, Megaphone } from "lucide-react";
import { Link } from "@/i18n/routing";
import { isPlatformAdmin, listReports, listShops } from "@/features/admin/queries";
import { shopAccess } from "@/features/billing/plans";
import { countryName } from "@/features/admin/components/planStyle";
import { AdminShopList, type AdminShopRow } from "@/features/admin/components/AdminShopList";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

const NEW_SHOP_DAYS = 7;

// The WISHOP console: every shop on the platform, its plan and its activity.
// Reserved to platform admins; anyone else gets a 404. What needs a look is
// coloured: red (suspended, read-only), amber (plan ending or in its grace
// period, new reports), indigo (new shops).
export default async function AdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const [t, locale, shops, reports] = await Promise.all([
    getTranslations("Admin"),
    getLocale(),
    listShops(),
    listReports(),
  ]);

  const now = new Date();
  const rows: AdminShopRow[] = shops.map((shop) => {
    const access = shopAccess(shop, now);
    return {
      ...shop,
      access,
      country: countryName(shop.country_code, locale),
      isNew: Boolean(shop.signed_up_at) && now.getTime() - new Date(shop.signed_up_at as string).getTime() < NEW_SHOP_DAYS * 24 * 60 * 60 * 1000,
      needsAttention: Boolean(shop.suspended_at) || access.mode !== "active",
    };
  });

  const newShops = rows.filter((row) => row.isNew).length;
  const paying = rows.filter((row) => row.access.plan !== "STANDARD" && row.access.mode !== "read_only").length;
  const attention = rows.filter((row) => row.needsAttention && !row.suspended_at).length;
  const suspended = rows.filter((row) => row.suspended_at).length;
  const newReports = reports.filter((report) => report.status === "NEW").length;

  const tile = (tone: "neutral" | "violet" | "amber" | "red", active: boolean) =>
    `relative rounded-2xl p-4 shadow-card ${
      !active || tone === "neutral"
        ? "bg-[var(--surface-1)]"
        : tone === "violet"
          ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-900/40"
          : tone === "amber"
            ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-900/40"
            : "bg-red-50 ring-1 ring-red-200 dark:bg-red-900/20 dark:ring-red-900/40"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-[14px] text-zinc-500">{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/messages"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-bold text-white hover:bg-violet-700"
        >
          <Megaphone className="h-4 w-4" /> {t("write_to_all")}
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className={tile("neutral", true)}>
          <dt className="text-[12px] font-semibold text-zinc-500">{t("shops")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{rows.length}</dd>
        </div>
        <div className={tile("violet", newShops > 0)}>
          <dt className="text-[12px] font-semibold text-zinc-500">{t("new_this_week")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{newShops}</dd>
        </div>
        <div className={tile("violet", paying > 0)}>
          <dt className="text-[12px] font-semibold text-zinc-500">{t("paid_plans")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{paying}</dd>
        </div>
        <div className={tile("amber", attention > 0)}>
          <dt className="text-[12px] font-semibold text-zinc-500">{t("attention")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{attention}</dd>
        </div>
        <div className={tile("red", suspended > 0)}>
          <dt className="text-[12px] font-semibold text-zinc-500">{t("suspended_shops")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{suspended}</dd>
        </div>
        <div className={`${tile("amber", newReports > 0)} hover:brightness-[0.98]`}>
          <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500">
            <Flag className="h-3.5 w-3.5" />
            <Link href="/admin/reports" className="after:absolute after:inset-0">
              {t("reports")}
            </Link>
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {newReports}
            <span className="ml-1.5 font-sans text-[12px] font-semibold text-zinc-500">{t("new_reports")}</span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="admin-shops" className="flex flex-col gap-3">
        <h2 id="admin-shops" className="text-lg font-bold">{t("shops")}</h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-1)] p-8 text-center text-[14px] text-zinc-500 shadow-card">{t("no_shops")}</p>
        ) : (
          <AdminShopList shops={rows} />
        )}
      </section>
    </div>
  );
}

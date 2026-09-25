import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getFormatters } from "@/features/settings/queries";
import { getShopEvents, isPlatformAdmin, listShops, type SubscriptionEvent } from "@/features/admin/queries";
import { shopAccess } from "@/features/billing/plans";
import { ACCESS_BADGE_CLASS, PLAN_BADGE_CLASS, countryName } from "@/features/admin/components/planStyle";
import { PlanActions } from "@/features/admin/components/PlanActions";
import { SuspendShop } from "@/features/admin/components/SuspendShop";
import { DeleteShop } from "@/features/admin/components/DeleteShop";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isPlatformAdmin())) notFound();
  const { id } = await params;

  const [t, locale, format, shops, events] = await Promise.all([
    getTranslations("Admin"),
    getLocale(),
    getFormatters(),
    listShops(),
    getShopEvents(id),
  ]);
  const shop = shops.find((s) => s.shop_id === id);
  if (!shop) notFound();

  const access = shopAccess(shop, new Date());
  const plan = access.plan;
  const hasPayments = events.some((event) => event.kind === "PAYMENT");

  const describe = (event: SubscriptionEvent) => {
    const planName = event.plan ? t(`plan_${event.plan}`) : "";
    const until = event.paid_until ? format.date(event.paid_until) : "";
    switch (event.kind) {
      case "GRANT":
        return t("event_grant", { count: event.months ?? 0, plan: planName, date: until });
      case "PAYMENT":
        return t("event_payment", {
          amount: format.money(event.amount ?? 0),
          method: event.method ? t(`method_${event.method}`) : "",
          count: event.months ?? 0,
          plan: planName,
          date: until,
        });
      case "STANDARD":
        return t("event_standard");
      case "SUSPEND":
        return t("event_suspend");
      case "RESUME":
        return t("event_resume");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{shop.shop_name || t("unnamed_shop")}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${PLAN_BADGE_CLASS[plan]}`}>{t(`plan_${plan}`)}</span>
          {access.mode !== "active" && (
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${ACCESS_BADGE_CLASS[access.mode]}`}>{t(`access_${access.mode}`)}</span>
          )}
          {shop.suspended_at && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[12px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {t("suspended_badge")}
            </span>
          )}
        </div>
        <p className="mt-1 text-[14px] text-zinc-500">
          {[shop.owner_name, countryName(shop.country_code, locale), shop.signed_up_at && t("signed_up", { date: format.date(shop.signed_up_at) })]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shop.owner_email && (
            <a
              href={`mailto:${shop.owner_email}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-1)] px-3 py-2 text-[13px] font-semibold shadow-card hover:bg-zinc-50 dark:hover:bg-white/5"
            >
              <Mail className="h-4 w-4" /> {shop.owner_email}
            </a>
          )}
          {shop.shop_slug && (
            <Link
              href={`/boutique/${shop.shop_slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-1)] px-3 py-2 text-[13px] font-semibold shadow-card hover:bg-zinc-50 dark:hover:bg-white/5"
            >
              <ExternalLink className="h-4 w-4" /> {t("view_storefront")}
            </Link>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("products")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{shop.product_count}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("invoices")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{shop.invoice_count}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("members")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{shop.member_count}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("last_sale_label")}</dt>
          <dd className="mt-1 text-[15px] font-semibold">{shop.last_sale_at ? format.date(shop.last_sale_at) : "—"}</dd>
        </div>
      </dl>

      <section aria-labelledby="admin-plan" className="flex flex-col gap-4 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
        <div>
          <h2 id="admin-plan" className="text-lg font-bold">{t("plan_section")}</h2>
          <p className="mt-1 text-[14px] text-zinc-500">
            {plan === "STANDARD"
              ? t("on_standard")
              : access.mode === "grace" || access.mode === "read_only"
                ? t(access.mode === "grace" ? "grace_until" : "read_only_since", {
                    plan: t(`plan_${plan}`),
                    date: format.date(shop.paid_until as string),
                    since: format.date(access.readOnlySince as string),
                  })
                : t("current_until", { plan: t(`plan_${plan}`), date: format.date(shop.paid_until as string, "long") })}
          </p>
        </div>
        <PlanActions shopId={shop.shop_id} current={{ plan: shop.plan, paid_until: shop.paid_until }} />
      </section>

      <section aria-labelledby="admin-suspension" className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
        <div>
          <h2 id="admin-suspension" className="text-lg font-bold">{t("suspension_section")}</h2>
          <p className="mt-1 text-[14px] text-zinc-500">
            {shop.suspended_at
              ? t("suspended_since", { date: format.date(shop.suspended_at) }) + (shop.suspension_reason ? ` — ${shop.suspension_reason}` : "")
              : t("suspension_hint")}
          </p>
        </div>
        <SuspendShop shopId={shop.shop_id} suspended={Boolean(shop.suspended_at)} />
      </section>

      <section aria-labelledby="admin-delete" className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card ring-1 ring-red-200 dark:ring-red-900/40 sm:p-6">
        <div>
          <h2 id="admin-delete" className="text-lg font-bold text-red-700 dark:text-red-400">{t("delete_section")}</h2>
          <p className="mt-1 text-[14px] text-zinc-500">{hasPayments ? t("delete_blocked_paid") : t("delete_hint")}</p>
        </div>
        {!hasPayments && (
          <DeleteShop shopId={shop.shop_id} shopName={shop.shop_name || t("unnamed_shop")} memberCount={shop.member_count} />
        )}
      </section>

      <section aria-labelledby="admin-history" className="flex flex-col gap-3">
        <h2 id="admin-history" className="text-lg font-bold">{t("history")}</h2>
        {events.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-1)] p-6 text-center text-[14px] text-zinc-500 shadow-card">{t("no_history")}</p>
        ) : (
          <ol className="divide-y divide-zinc-100 rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 px-4 py-3">
                <p className="text-[14px] font-semibold">{describe(event)}</p>
                <p className="text-[12px] text-zinc-500">
                  {format.date(event.created_at, "dateTime")}
                  {event.note && ` · ${event.note}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { lockedFeature } from "@/features/billing/gate";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getOnlineOrders } from "@/features/online-orders/actions";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import OnlineOrderList from "@/features/online-orders/components/OnlineOrderList";

export async function generateMetadata() {
  const t = await getTranslations("OnlineOrders");
  return { title: t("title") };
}

export default async function OnlineOrdersPage() {
  const locked = await lockedFeature("storefront");
  if (locked) return locked;
  const [t, orders, shopSettings, format] = await Promise.all([
    getTranslations("OnlineOrders"),
    getOnlineOrders(),
    getShopSettings(),
    getFormatters(),
  ]);

  const pending = orders.filter((order) => order.status === "PENDING");
  const pendingTotal = pending.reduce((sum, order) => sum + order.total_amount, 0);
  const slug = shopSettings?.shop_slug;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-[14px] text-zinc-500">{t("intro")}</p>
        </div>
        {slug ? (
          <Link
            href={`/boutique/${slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-1)] px-4 py-2.5 text-[13px] font-semibold shadow-card hover:bg-zinc-50 dark:hover:bg-white/5"
          >
            <ExternalLink className="h-4 w-4" /> {t("view_storefront")}
          </Link>
        ) : (
          <Link href="/settings" className="text-[13px] font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300">
            {t("set_storefront_address")}
          </Link>
        )}
      </div>

      {orders.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
            <dt className="text-[12px] font-semibold text-zinc-500">{t("to_confirm")}</dt>
            <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${pending.length > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
              {pending.length}
            </dd>
          </div>
          <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
            <dt className="text-[12px] font-semibold text-zinc-500">{t("to_confirm_amount")}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{format.money(pendingTotal)}</dd>
          </div>
        </dl>
      )}

      <OnlineOrderList orders={orders} />
    </div>
  );
}

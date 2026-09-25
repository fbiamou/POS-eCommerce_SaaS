"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useOptionalOfflineContext } from "@/features/offline/OfflineProvider";
import { TOP_SALES_PERIODS, type TopSalesPeriod } from "@/features/sales/stats";
import { dashboardFigures, type DashboardFigures } from "../figures";

const card = "rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm";

const STATUS_CLASS: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  PARTIAL: "bg-[#FFF3CD] text-[#856404] dark:bg-[#FBBF24]/20 dark:text-[#FBBF24]",
  UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// The dashboard's figures, recent invoices and best sellers. With offline
// mode they come from the device's copy of the shop (a sale made offline
// counts at once); until the device has its copy, from the server's. The
// quick actions (reminders) stay the server's, passed in as they are.
export function DashboardBody({
  server,
  serverPeriod,
  quickActions,
}: {
  server: DashboardFigures;
  serverPeriod: TopSalesPeriod;
  quickActions: React.ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const tOffline = useTranslations("Offline");
  const format = useShopFormat();
  const offline = useOptionalOfflineContext();
  const searchParams = useSearchParams();
  const asked = searchParams.get("period");
  // Offline, the kept copy of the page may have been made for another period.
  const period: TopSalesPeriod = TOP_SALES_PERIODS.includes(asked as TopSalesPeriod) ? (asked as TopSalesPeriod) : serverPeriod;

  const db = offline?.status.ready ? offline.db : null;
  const local = useLiveQuery(
    async () => {
      if (!db) return null;
      // Only what the figures need: the last 31 days, what is still owed,
      // and the five latest invoices, whatever their date.
      const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const [recent, owing, latest, products] = await Promise.all([
        db.invoices.where("created_at").aboveOrEqual(since).toArray(),
        db.invoices.where("status").anyOf(["UNPAID", "PARTIAL"]).toArray(),
        db.invoices.orderBy("created_at").reverse().limit(5).toArray(),
        db.products.toArray(),
      ]);
      const invoices = [...new Map([...recent, ...owing, ...latest].map((inv) => [inv.id, inv])).values()];
      const items = await db.invoice_items.where("invoice_id").anyOf(recent.map((inv) => inv.id)).toArray();
      return { invoices, items, products };
    },
    [db],
    null
  );

  const unknownProduct = t("unknown_product");
  const figures = useMemo(
    () =>
      local
        ? dashboardFigures({
            ...local,
            now: new Date(),
            timeZone: format.timeZone,
            lowStockThreshold: format.lowStockThreshold,
            period,
            unknownProduct,
          })
        : server,
    [local, server, format.timeZone, format.lowStockThreshold, period, unknownProduct]
  );

  const statusLabel: Record<string, string> = { PAID: t("paid"), PARTIAL: t("partial"), UNPAID: t("unpaid") };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <div className={`${card} flex min-h-[100px] flex-col justify-between p-4 sm:p-5`}>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("today_ca")}</span>
          <span className="mt-2 font-mono text-[17px] font-bold leading-tight tabular-nums text-zinc-900 dark:text-white sm:text-xl">
            {format.money(figures.todayRevenue)}
          </span>
        </div>

        <div className={`${card} flex min-h-[100px] flex-col justify-between p-4 sm:p-5`}>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("sales_count")}</span>
          <span className="mt-2 font-mono text-[17px] font-bold leading-tight tabular-nums text-zinc-900 dark:text-white sm:text-xl">
            {figures.salesCount}
          </span>
        </div>

        <Link href="/clients" className={`${card} flex min-h-[100px] flex-col justify-between p-4 sm:p-5`}>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("debts")}</span>
          <span className="mt-2 font-mono text-[17px] font-bold leading-tight tabular-nums text-red-600 dark:text-red-400 sm:text-xl">
            {format.money(figures.totalDebt)}
          </span>
        </Link>

        <Link href="/stock" className={`${card} flex min-h-[100px] flex-col justify-between p-4 sm:p-5`}>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("low_stock")}</span>
          <span className="mt-2 text-[17px] font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-400 sm:text-xl">
            {t("articles_count", { count: figures.lowStockCount })}
          </span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} p-5 sm:p-6`}>
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t("recent_invoices")}</h2>
          <div className="flex flex-col gap-4">
            {figures.recentInvoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="group flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-400">
                    {inv.client_name || t("walk_in_client")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                    {inv.invoice_number}
                    {inv.local_state === "pending" && <CloudOff className="h-3 w-3 text-amber-700" aria-label={tOffline("badge_pending")} />}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{format.money(inv.total_amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[inv.status]}`}>{statusLabel[inv.status]}</span>
                </div>
              </Link>
            ))}
            {figures.recentInvoices.length === 0 && <p className="text-sm text-zinc-500">{t("no_recent_invoices")}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {quickActions}

          <div className={`${card} flex-1 p-5 sm:p-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t("top_sales")}</h2>
              <nav className="flex gap-1" aria-label={t("top_sales")}>
                {TOP_SALES_PERIODS.map((p) => (
                  <Link
                    key={p}
                    href={{ pathname: "/dashboard", query: { period: p } }}
                    aria-current={p === period ? "page" : undefined}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      p === period ? "bg-violet-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {t(`period_${p}`)}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-3">
              {figures.topArticles.map((article) => (
                <div key={article.productId} className="flex items-center justify-between border-b border-zinc-50 pb-2 last:border-0 last:pb-0 dark:border-white/5">
                  <span className="truncate pr-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">{article.name}</span>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-violet-600 dark:text-violet-400">
                    {t("sold_count", { count: article.quantity })}
                  </span>
                </div>
              ))}
              {figures.topArticles.length === 0 && <p className="text-sm text-zinc-500">{t(`no_sales_${period}`)}</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

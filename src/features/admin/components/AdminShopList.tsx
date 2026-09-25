"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Select } from "@/components/ui/Select";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { PLANS, type Plan, type ShopAccess } from "@/features/billing/plans";
import type { AdminShop } from "../queries";
import { ACCESS_BADGE_CLASS, PLAN_BADGE_CLASS, shopLanguage } from "./planStyle";

export type AdminShopRow = AdminShop & { access: ShopAccess; country: string; isNew: boolean; needsAttention: boolean };

const PAGE = 50;

// Every shop of the platform, searchable (shop, owner, email, address) and
// filtered by plan, situation and country: built for hundreds of shops.
// The coloured left edge says what needs a look: red (suspended or
// read-only), amber (plan ending or in its grace period), indigo (new).
export function AdminShopList({ shops }: { shops: AdminShopRow[] }) {
  const t = useTranslations("Admin");
  const format = useShopFormat();
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<Plan | "ALL">("ALL");
  const [situation, setSituation] = useState<"all" | "attention" | "new">("all");
  const [country, setCountry] = useState("");
  const [shown, setShown] = useState(PAGE);

  const countries = useMemo(
    () => [...new Set(shops.map((s) => s.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [shops],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return shops.filter((shop) => {
      if (plan !== "ALL" && shop.access.plan !== plan) return false;
      if (situation === "attention" && !shop.needsAttention) return false;
      if (situation === "new" && !shop.isNew) return false;
      if (country && shop.country !== country) return false;
      if (!needle) return true;
      return [shop.shop_name, shop.owner_name, shop.owner_email, shop.shop_slug]
        .some((value) => value?.toLocaleLowerCase().includes(needle));
    });
  }, [shops, query, plan, situation, country]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active ? "bg-night text-white dark:bg-violet-500" : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;

  const edge = (shop: AdminShopRow) =>
    shop.suspended_at || shop.access.mode === "read_only"
      ? "border-l-red-500"
      : shop.access.mode === "grace" || shop.access.mode === "ending_soon"
        ? "border-l-amber-500"
        : shop.isNew
          ? "border-l-violet-500"
          : "border-l-transparent";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder={t("search_placeholder")}
          className="w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] py-3 pl-11 pr-4 text-[15px] outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setSituation("all")} className={chip(situation === "all")}>{t("filter_all")}</button>
          <button type="button" onClick={() => setSituation("attention")} className={chip(situation === "attention")}>
            {t("filter_attention")} <span className="ml-1 font-mono tabular-nums opacity-70">{shops.filter((s) => s.needsAttention).length}</span>
          </button>
          <button type="button" onClick={() => setSituation("new")} className={chip(situation === "new")}>
            {t("filter_new")} <span className="ml-1 font-mono tabular-nums opacity-70">{shops.filter((s) => s.isNew).length}</span>
          </button>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <Select
            value={plan}
            onChange={(value) => setPlan(value as Plan | "ALL")}
            ariaLabel={t("field_plan")}
            className="w-40"
            triggerClassName="py-1.5 text-[13px]"
            options={[{ value: "ALL", label: t("all_plans") }, ...PLANS.map((p) => ({ value: p, label: t(`plan_${p}`) }))]}
          />
          {countries.length > 1 && (
            <Select
              value={country}
              onChange={setCountry}
              ariaLabel={t("all_countries")}
              className="w-44"
              triggerClassName="py-1.5 text-[13px]"
              options={[{ value: "", label: t("all_countries") }, ...countries.map((c) => ({ value: c, label: c }))]}
            />
          )}
        </div>
      </div>

      <p className="text-[13px] text-zinc-500">{t("results_count", { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-[var(--surface-1)] p-8 text-center text-[14px] text-zinc-500 shadow-card">{t("no_results")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.slice(0, shown).map((shop) => {
            const current = shop.access.plan;
            return (
              <li key={shop.shop_id}>
                <Link
                  href={`/admin/shops/${shop.shop_id}`}
                  className={`flex items-center gap-3 rounded-2xl border-l-4 bg-[var(--surface-1)] p-4 shadow-card hover:bg-zinc-50 dark:hover:bg-white/5 ${edge(shop)}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{shop.shop_name || t("unnamed_shop")}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PLAN_BADGE_CLASS[current]}`}>{t(`plan_${current}`)}</span>
                      {shop.access.mode !== "active" && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ACCESS_BADGE_CLASS[shop.access.mode]}`}>{t(`access_${shop.access.mode}`)}</span>
                      )}
                      {shop.suspended_at && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("suspended_badge")}</span>
                      )}
                      {shop.isNew && (
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{t("new_badge")}</span>
                      )}
                    </div>
                    <p className="truncate text-[13px] text-zinc-500">
                      {[shop.owner_name, shop.owner_email, shop.country].filter(Boolean).join(" · ")}
                      {(() => {
                        const language = shopLanguage(shop.owner_locale, shop.country_code);
                        return language ? ` · ${t(`language_${language.code}`)}` : "";
                      })()}
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {t("activity", { products: shop.product_count, invoices: shop.invoice_count, members: shop.member_count })}
                      {shop.last_sale_at && ` · ${t("last_sale", { date: format.date(shop.last_sale_at) })}`}
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      {shop.signed_up_at && t("signed_up", { date: format.date(shop.signed_up_at) })}
                      {current !== "STANDARD" && shop.paid_until && ` · ${t("until", { date: format.date(shop.paid_until) })}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="self-center rounded-xl px-5 py-2.5 text-[14px] font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-800"
        >
          {t("show_more", { count: filtered.length - shown })}
        </button>
      )}
    </div>
  );
}

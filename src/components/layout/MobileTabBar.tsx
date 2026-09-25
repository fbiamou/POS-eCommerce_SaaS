"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Settings as SettingsIcon, ExternalLink, ShieldCheck, Lock } from "lucide-react";
import { planAllows, type Plan } from "@/features/billing/plans";
import { isPageAllowed, type AppPageKey } from "@/lib/appPages";
import { buildNavItems } from "./navItems";
import { Modal } from "@/components/ui/Modal";

type Profile = {
  role: string;
  allowed_pages?: string[];
};

type MobileTabBarProps = {
  profile?: Profile | null;
  shopSlug?: string | null;
  isPlatformAdmin?: boolean;
  plan?: Plan;
};

// Bottom tab bar for phones. The till ("Vendre") is the action staff take
// dozens of times a day, so it sits in the middle as a raised button; the
// other tabs sit around it and everything else lives behind "Plus".
const LEFT_KEYS: AppPageKey[] = ["dashboard", "stock"];
const CENTER_KEY: AppPageKey = "sales";
const RIGHT_KEYS: AppPageKey[] = ["invoices"];

// The full nav labels ("Ventes & Facturation", "Tableau de Bord"...) wrap
// awkwardly at tab-bar width — short, tab-specific labels instead.
const TAB_LABEL_KEY: Record<string, string> = {
  dashboard: "tab_dashboard",
  sales: "tab_sales",
  stock: "tab_stock",
  invoices: "tab_invoices",
};

export function MobileTabBar({ profile, shopSlug, isPlatformAdmin = false, plan = "PRO_PLUS" }: MobileTabBarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const canSee = (path: string) => isPageAllowed(profile?.role || "SELLER", profile?.allowed_pages ?? [], path);

  const allItems = buildNavItems(t).filter((item) => canSee(item.path));
  const pick = (keys: AppPageKey[]) =>
    keys.map((key) => allItems.find((item) => item.key === key)).filter(
      (item): item is NonNullable<typeof item> => Boolean(item)
    );
  const left = pick(LEFT_KEYS);
  const right = pick(RIGHT_KEYS);
  const center = allItems.find((item) => item.key === CENTER_KEY);
  const shownKeys = [...LEFT_KEYS, CENTER_KEY, ...RIGHT_KEYS];
  const overflow = allItems.filter((item) => !shownKeys.includes(item.key));
  const showSettings = canSee("/settings");
  const hasMore = overflow.length > 0 || showSettings || Boolean(shopSlug) || isPlatformAdmin;

  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname === path || pathname.startsWith(path + "/");

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold transition-colors ${
      active ? "text-violet-700 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
    }`;

  const renderTab = (item: (typeof allItems)[number]) => {
    const active = isActive(item.path);
    return (
      <Link key={item.key} href={item.path} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        <span
          className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
            active ? "bg-violet-100 dark:bg-[var(--surface-3)]" : ""
          }`}
        >
          <item.icon className="h-[19px] w-[19px]" />
        </span>
        {t(TAB_LABEL_KEY[item.key])}
      </Link>
    );
  };

  const overflowLinkClass =
    "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 transition-colors";

  return (
    <>
      <nav
        aria-label={t("app_name")}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-zinc-200 bg-[var(--surface-1)] pb-[env(safe-area-inset-bottom)] dark:border-[var(--line)]"
      >
        {left.map(renderTab)}
        {center && (
          <Link
            href={center.path}
            aria-current={isActive(center.path) ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 text-[11px] font-bold text-violet-700 dark:text-white"
          >
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_8px_18px_-6px_rgba(43,68,160,0.6)] ring-4 ring-[var(--surface-1)]">
              <center.icon className="h-6 w-6" />
            </span>
            {t(TAB_LABEL_KEY[center.key])}
          </Link>
        )}
        {right.map(renderTab)}
        {hasMore && (
          <button type="button" onClick={() => setShowMore(true)} className={tabClass(false)}>
            <span className="flex h-8 w-12 items-center justify-center rounded-full">
              <MoreHorizontal className="h-[19px] w-[19px]" />
            </span>
            {t("more")}
          </button>
        )}
      </nav>

      <Modal isOpen={showMore} onClose={() => setShowMore(false)} title={t("more")}>
        <div className="flex flex-col gap-0.5">
          {overflow.map((item) => (
            <Link key={item.key} href={item.path} onClick={() => setShowMore(false)} className={overflowLinkClass}>
              <item.icon className="h-5 w-5 text-violet-600" /> {item.label}
              {item.feature && !planAllows(plan, item.feature) && (
                <Lock className="ml-auto h-4 w-4 text-zinc-400" aria-label={t("locked")} />
              )}
            </Link>
          ))}
          {isPlatformAdmin && (
            <Link href="/admin" onClick={() => setShowMore(false)} className={overflowLinkClass}>
              <ShieldCheck className="h-5 w-5 text-violet-600" /> {t("admin")}
            </Link>
          )}
          {showSettings && (
            <Link href="/settings" onClick={() => setShowMore(false)} className={overflowLinkClass}>
              <SettingsIcon className="h-5 w-5 text-violet-600" /> {t("settings")}
            </Link>
          )}
          {shopSlug && (
            <Link
              href={`/boutique/${shopSlug}`}
              target="_blank"
              onClick={() => setShowMore(false)}
              className={overflowLinkClass}
            >
              <ExternalLink className="h-5 w-5 text-violet-600" /> {tSettings("view_online_shop")}
            </Link>
          )}
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Settings as SettingsIcon, ExternalLink } from "lucide-react";
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
};

// Mirrors the bottom tab bar validated in the design charter (Ventes /
// Factures / Stock / Plus) with Dashboard added as the home tab — a real
// bottom bar can't fit all ten app pages, so everything else lives behind
// "Plus".
const PRIMARY_KEYS: AppPageKey[] = ["dashboard", "sales", "stock", "invoices"];

// The full nav labels ("Ventes & Facturation", "Tableau de Bord"...) wrap
// awkwardly at tab-bar width — short, tab-specific labels instead.
const TAB_LABEL_KEY: Record<string, string> = {
  dashboard: "tab_dashboard",
  sales: "tab_sales",
  stock: "tab_stock",
  invoices: "tab_invoices",
};

export function MobileTabBar({ profile, shopSlug }: MobileTabBarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const canSee = (path: string) => isPageAllowed(profile?.role || "SELLER", profile?.allowed_pages ?? [], path);

  const allItems = buildNavItems(t).filter((item) => canSee(item.path));
  const primary = PRIMARY_KEYS.map((key) => allItems.find((item) => item.key === key)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item)
  );
  const overflow = allItems.filter((item) => !PRIMARY_KEYS.includes(item.key));
  const showSettings = canSee("/settings");
  const hasMore = overflow.length > 0 || showSettings || Boolean(shopSlug);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t bg-card pb-[env(safe-area-inset-bottom)]">
        {primary.map((item) => (
          <Link
            key={item.key}
            href={item.path}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
              isActive(item.path) ? "text-violet-600" : "text-zinc-500"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {t(TAB_LABEL_KEY[item.key])}
          </Link>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-zinc-500"
          >
            <MoreHorizontal className="h-5 w-5" />
            {t("more")}
          </button>
        )}
      </nav>

      <Modal isOpen={showMore} onClose={() => setShowMore(false)} title={t("more")}>
        <div className="flex flex-col gap-1">
          {overflow.map((item) => (
            <Link
              key={item.key}
              href={item.path}
              onClick={() => setShowMore(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
          {showSettings && (
            <Link
              href="/settings"
              onClick={() => setShowMore(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <SettingsIcon className="h-4 w-4" /> {t("settings")}
            </Link>
          )}
          {shopSlug && (
            <Link
              href={`/boutique/${shopSlug}`}
              target="_blank"
              onClick={() => setShowMore(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
            >
              <ExternalLink className="h-4 w-4" /> {tSettings("view_online_shop")}
            </Link>
          )}
        </div>
      </Modal>
    </>
  );
}

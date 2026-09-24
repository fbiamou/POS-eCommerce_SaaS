"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Settings, LogOut, ExternalLink } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/[locale]/login/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WishopMark } from "@/components/brand/WishopMark";
import { isPageAllowed } from "@/lib/appPages";
import { buildNavItems } from "./navItems";
import { ShopAvatar, getInitials } from "./ShopAvatar";

type Profile = {
  full_name: string | null;
  role: string;
  allowed_pages?: string[];
}

type SidebarProps = {
  profile?: Profile | null;
  shopName?: string | null;
  shopLogoUrl?: string | null;
  shopSlug?: string | null;
}

// Desktop-only persistent navigation, on the indigo night ground that anchors
// the WISHOP identity (the content area stays light for daylight use in the
// shop). On mobile, the primary way the owner and sellers use the app,
// MobileTopBar + MobileTabBar take over instead.
export default function Sidebar({ profile, shopName, shopLogoUrl, shopSlug }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const roleLabel: Record<string, string> = {
    MANAGER: tSettings("role_manager"),
    SELLER: tSettings("role_cashier"),
  };

  const canSee = (path: string) =>
    isPageAllowed(profile?.role || "SELLER", profile?.allowed_pages ?? [], path);

  const NAV_ITEMS = buildNavItems(t);
  const displayName = shopName || t("app_name");

  const linkClass = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors ${
      active
        ? "bg-[var(--nav-active)] text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-saffron"
        : "text-[var(--nav-fg)] hover:bg-[var(--nav-hover)] hover:text-white"
    }`;

  return (
    <aside className="hidden md:flex h-full w-64 shrink-0 flex-col bg-[var(--nav-bg)] text-[var(--nav-fg)]">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <WishopMark className="h-6 w-auto text-white" />
        <span className="font-display text-[19px] font-extrabold tracking-tight text-white">{t("app_name")}</span>
      </div>

      <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5">
        <ShopAvatar logoUrl={shopLogoUrl} name={displayName} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          {shopSlug && (
            <Link
              href={`/boutique/${shopSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-[var(--nav-fg)] hover:text-white"
            >
              {tSettings("view_online_shop")}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t("app_name")}>
        <ul className="space-y-0.5">
          {NAV_ITEMS.filter((item) => canSee(item.path)).map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.key}>
                <Link href={item.path} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--nav-line)] px-3 py-3">
        {canSee("/settings") && (
          <Link href="/settings" aria-current={isActive("/settings") ? "page" : undefined} className={linkClass(isActive("/settings"))}>
            <Settings className="h-4 w-4 shrink-0" />
            {t("settings")}
          </Link>
        )}
        <div className="mt-1 flex items-center justify-between px-3 py-1.5">
          <LocaleSwitcher variant="dropdown" tone="dark" />
          <ThemeToggle
            tone="dark"
            switchToLightLabel={t("switch_to_light")}
            switchToDarkLabel={t("switch_to_dark")}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--nav-line)] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
          {getInitials(profile?.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{profile?.full_name || tSettings("no_name")}</p>
          <p className="text-xs text-[var(--nav-fg)]">{roleLabel[profile?.role || ""] || profile?.role || ""}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={t("logout")}
          aria-label={t("logout")}
          className="rounded-md p-1.5 text-[var(--nav-fg)] transition-colors hover:bg-[var(--nav-hover)] hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

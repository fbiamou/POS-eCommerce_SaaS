"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ChevronDown, Settings, LogOut } from "lucide-react";
import { SyncStatus } from "@/features/offline/components/SyncStatus";
import { LogoutBlockedDialog, useSafeLogout } from "@/features/offline/components/SafeLogout";
import { useNavAccess } from "@/features/offline/useTillAccess";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isPageAllowed } from "@/lib/appPages";
import { ShopAvatar, getInitials } from "./ShopAvatar";

type Profile = {
  full_name: string | null;
  role: string;
  allowed_pages?: string[];
  session_user?: unknown;
};

type MobileTopBarProps = {
  profile?: Profile | null;
  shopName?: string | null;
  shopLogoUrl?: string | null;
};

export function MobileTopBar({ profile, shopName, shopLogoUrl }: MobileTopBarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const [open, setOpen] = useState(false);
  const safeLogout = useSafeLogout();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const roleLabel: Record<string, string> = {
    MANAGER: tSettings("role_manager"),
    SELLER: tSettings("role_cashier"),
  };

  // A colleague holding the till with her code: her rights.
  const access = useNavAccess(profile);
  const canSeeSettings = isPageAllowed(access.role, access.allowedPages, "/settings");

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-zinc-200 bg-[var(--surface-1)] px-4 pt-[env(safe-area-inset-top)] dark:border-[var(--line)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShopAvatar logoUrl={shopLogoUrl} name={shopName || t("app_name")} size={28} />
        <span className="font-display text-[17px] font-extrabold tracking-tight truncate">{shopName || t("app_name")}</span>
      </div>

      <div className="relative flex shrink-0 items-center gap-2" ref={panelRef}>
        <SyncStatus />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("app_name")}
          className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 hover:bg-zinc-100 dark:hover:bg-[var(--line)]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-night text-xs font-bold text-white dark:bg-[var(--surface-3)]">
            {getInitials(access.name)}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-zinc-100 bg-white p-2 shadow-sm dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
            <div className="mb-1 border-b border-zinc-100 px-3 py-2 dark:border-[var(--line)]">
              <p className="truncate text-sm font-medium">{access.name || tSettings("no_name")}</p>
              <p className="text-xs text-zinc-500">{roleLabel[access.role] || access.role}</p>
            </div>
            {canSeeSettings && (
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100/50 hover:text-violet-600 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
              >
                <Settings className="h-4 w-4" /> {t("settings")}
              </Link>
            )}
            <div className="flex items-center justify-between px-3 py-2">
              <LocaleSwitcher variant="dropdown" />
              <ThemeToggle switchToLightLabel={t("switch_to_light")} switchToDarkLabel={t("switch_to_dark")} />
            </div>
            <button
              onClick={() => void safeLogout.run()}
              disabled={safeLogout.loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" /> {t("logout")}
            </button>
          </div>
        )}
      </div>
      <LogoutBlockedDialog count={safeLogout.blocked} onClose={safeLogout.closeBlocked} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ChevronDown, Settings, LogOut } from "lucide-react";
import { logout } from "@/app/[locale]/login/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isPageAllowed } from "@/lib/appPages";

type Profile = {
  full_name: string | null;
  role: string;
  allowed_pages?: string[];
};

type MobileTopBarProps = {
  profile?: Profile | null;
  shopName?: string | null;
  shopLogoUrl?: string | null;
};

function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "U";
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

export function MobileTopBar({ profile, shopName, shopLogoUrl }: MobileTopBarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  const canSeeSettings = isPageAllowed(profile?.role || "SELLER", profile?.allowed_pages ?? [], "/settings");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-[#1C1A22] border-b border-zinc-100 dark:border-[#2d2936] z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-2 min-w-0">
        {shopLogoUrl ? (
          <Image src={shopLogoUrl} alt="Logo" width={24} height={24} className="h-6 w-6 rounded-md object-cover shrink-0" />
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-600">
            <span className="text-xs font-bold text-white">{(shopName || t("app_name"))[0]?.toUpperCase()}</span>
          </div>
        )}
        <span className="text-base font-bold truncate">{shopName || t("app_name")}</span>
      </div>

      <div className="relative shrink-0" ref={panelRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("app_name")}
          className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 hover:bg-zinc-100 dark:hover:bg-[#2d2936]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-violet-600 text-xs font-bold text-white">
            {getInitials(profile?.full_name)}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-zinc-100 bg-white p-2 shadow-sm dark:border-[#2d2936] dark:bg-[#1C1A22]">
            <div className="mb-1 border-b border-zinc-100 px-3 py-2 dark:border-[#2d2936]">
              <p className="truncate text-sm font-medium">{profile?.full_name || tSettings("no_name")}</p>
              <p className="text-xs text-zinc-500">{roleLabel[profile?.role || ""] || profile?.role || ""}</p>
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
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" /> {t("logout")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

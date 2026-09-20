"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Package, ShoppingCart, Users, MessageCircle, Settings, LayoutDashboard, Menu, X, LogOut, Store, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/[locale]/login/actions";
import Image from "next/image";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isPageAllowed, type AppPageKey } from "@/lib/appPages";

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

function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "U";
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

export default function Sidebar({ profile, shopName, shopLogoUrl, shopSlug }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const closeSidebar = () => setIsOpen(false);

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

  const NAV_ITEMS: { key: AppPageKey; path: string; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "dashboard", path: "/", label: t("dashboard"), icon: LayoutDashboard },
    { key: "stock", path: "/stock", label: t("stock"), icon: Package },
    { key: "shipments", path: "/shipments", label: t("shipments"), icon: Package },
    { key: "purchase_orders", path: "/purchase-orders", label: t("purchase_orders"), icon: ShoppingCart },
    { key: "sales", path: "/sales", label: t("sales"), icon: ShoppingCart },
    { key: "invoices", path: "/invoices", label: t("invoices"), icon: FileText },
    { key: "clients", path: "/clients", label: t("clients"), icon: Users },
    { key: "reminders", path: "/reminders", label: t("reminders"), icon: MessageCircle },
    { key: "online_orders", path: "/online-orders", label: t("online_orders"), icon: Store },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-white dark:bg-black z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {shopLogoUrl ? (
            <Image src={shopLogoUrl} alt="Logo" width={24} height={24} className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600">
              <span className="text-xs font-bold text-white">{(shopName || t("app_name"))[0]?.toUpperCase()}</span>
            </div>
          )}
          <span className="text-base font-bold">{shopName || t("app_name")}</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 -mr-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-zinc-50 dark:bg-zinc-900 
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex h-14 items-center border-b px-4 justify-between">
          <div className="flex items-center gap-2">
            {shopLogoUrl ? (
              <Image src={shopLogoUrl} alt="Logo" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
                <span className="text-xs font-bold text-white">{(shopName || t("app_name"))[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm font-bold truncate max-w-[120px]">{shopName || t("app_name")}</span>
          </div>
          <button onClick={closeSidebar} className="md:hidden p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Sélecteur de langue + thème */}
        <div className="border-b p-3 flex items-center justify-between gap-2">
          <LocaleSwitcher variant="dropdown" />
          <ThemeToggle
            switchToLightLabel={t("switch_to_light")}
            switchToDarkLabel={t("switch_to_dark")}
          />
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS.filter((item) => canSee(item.path)).map((item) => (
              <li key={item.key}>
                <Link href={item.path} onClick={closeSidebar} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
            {shopSlug && (
              <li>
                <Link
                  href={`/boutique/${shopSlug}`}
                  target="_blank"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                >
                  <ExternalLink className="h-4 w-4" />
                  {tSettings("view_online_shop")}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Bottom section: Settings + Profile + Logout */}
        <div className="border-t">
          {canSee("/settings") && (
            <div className="p-2">
              <Link href="/settings" onClick={closeSidebar} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Settings className="h-4 w-4" />
                {t("settings")}
              </Link>
            </div>
          )}

          {/* User Profile card */}
          <div className="border-t p-3">
            <div className="flex items-center gap-3 px-1 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-violet-600 text-xs font-bold text-white shrink-0">
                {getInitials(profile?.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || "Utilisateur"}
                </p>
                <p className="text-xs text-zinc-500">
                  {roleLabel[profile?.role || ""] || profile?.role || ""}
                </p>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Se déconnecter"
                className="p-1.5 rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

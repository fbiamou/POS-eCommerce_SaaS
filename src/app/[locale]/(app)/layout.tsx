import Sidebar from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ShopFormatProvider } from "@/components/ShopFormatProvider";
import { Toaster } from "@/components/ui/Toast";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopFormat, getShopSettings } from "@/features/settings/queries";
import { getOwnSubscription, isPlatformAdmin } from "@/features/admin/queries";
import { ShopSuspended } from "@/features/admin/components/ShopSuspended";

// Shared chrome for every authenticated dashboard page. Desktop keeps the
// persistent Sidebar; mobile — the primary usage per AGENTS.md — gets its
// own top bar + bottom tab bar instead (see MobileTopBar/MobileTabBar).
// Public pages (login, storefront, procurement intake) live outside this
// route group and never render this layout.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, shopSettings, shopFormat, isAdmin, subscription] = await Promise.all([
    getCurrentProfile(),
    getShopSettings(),
    getShopFormat(),
    isPlatformAdmin(),
    getOwnSubscription(),
  ]);
  // A shop suspended by WISHOP sees a notice instead of its pages. A platform
  // admin is never locked out of the console this way.
  const suspended = Boolean(subscription?.suspended_at) && !isAdmin;

  return (
    <ShopFormatProvider value={shopFormat}>
      <div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
        <Sidebar
          profile={profile}
          shopName={shopSettings?.shop_name}
          shopLogoUrl={shopSettings?.shop_logo_url}
          shopSlug={shopSettings?.shop_slug}
          isPlatformAdmin={isAdmin}
        />
        <MobileTopBar
          profile={profile}
          shopName={shopSettings?.shop_name}
          shopLogoUrl={shopSettings?.shop_logo_url}
        />
        <main className="w-full flex-1 overflow-y-auto bg-background px-4 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-8 md:pt-8 md:pb-8">
          {suspended ? <ShopSuspended reason={subscription?.suspension_reason ?? null} /> : children}
        </main>
        <MobileTabBar profile={profile} shopSlug={shopSettings?.shop_slug} isPlatformAdmin={isAdmin} />
        <Toaster />
      </div>
    </ShopFormatProvider>
  );
}

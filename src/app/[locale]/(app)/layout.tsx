import Sidebar from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopSettings } from "@/features/settings/actions";

// Shared chrome for every authenticated dashboard page. Desktop keeps the
// persistent Sidebar; mobile — the primary usage per AGENTS.md — gets its
// own top bar + bottom tab bar instead (see MobileTopBar/MobileTabBar).
// Public pages (login, storefront, procurement intake) live outside this
// route group and never render this layout.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, shopSettings] = await Promise.all([
    getCurrentProfile(),
    getShopSettings(),
  ]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
      <Sidebar
        profile={profile}
        shopName={shopSettings?.shop_name}
        shopLogoUrl={shopSettings?.shop_logo_url}
        shopSlug={shopSettings?.shop_slug}
      />
      <MobileTopBar
        profile={profile}
        shopName={shopSettings?.shop_name}
        shopLogoUrl={shopSettings?.shop_logo_url}
      />
      <main className="w-full flex-1 overflow-y-auto bg-background p-4 pt-16 pb-20 md:p-8 md:pt-8 md:pb-8">
        {children}
      </main>
      <MobileTabBar profile={profile} shopSlug={shopSettings?.shop_slug} />
    </div>
  );
}

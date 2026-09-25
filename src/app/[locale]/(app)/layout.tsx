import Sidebar from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ShopFormatProvider } from "@/components/ShopFormatProvider";
import { Toaster } from "@/components/ui/Toast";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopFormat, getShopSettings } from "@/features/settings/queries";
import { getOwnSubscription, isPlatformAdmin } from "@/features/admin/queries";
import { ShopSuspended } from "@/features/admin/components/ShopSuspended";
import { getShopAccess } from "@/features/billing/access";
import { planAllows } from "@/features/billing/plans";
import { PlanBanner } from "@/features/billing/components/PlanBanner";
import { getUnreadMessages } from "@/features/messages/queries";
import { ShopMessages } from "@/features/messages/components/ShopMessages";

// Shared chrome for every authenticated dashboard page. Desktop keeps the
// persistent Sidebar; mobile — the primary usage per AGENTS.md — gets its
// own top bar + bottom tab bar instead (see MobileTopBar/MobileTabBar).
// Public pages (login, storefront, procurement intake) live outside this
// route group and never render this layout.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, shopSettings, shopFormat, isAdmin, subscription, access] = await Promise.all([
    getCurrentProfile(),
    getShopSettings(),
    getShopFormat(),
    isPlatformAdmin(),
    getOwnSubscription(),
    getShopAccess(),
  ]);
  const isManager = profile?.role === "MANAGER";
  // Messages from WISHOP are for the owner (a seller never sees them).
  const messages = isManager ? await getUnreadMessages(profile?.created_at ?? null) : [];
  // The storefront link only shows while the storefront is actually online.
  const storefrontOpen = planAllows(access.plan, "storefront") && access.mode !== "read_only";
  const liveSlug = storefrontOpen && shopSettings?.shop_slug ? shopSettings.shop_slug : null;
  // The plan includes a storefront but no address was chosen yet: the menu
  // says where to choose it instead of showing no link at all.
  const storefrontNeedsAddress = storefrontOpen && !shopSettings?.shop_slug && isManager;
  // A shop suspended by WISHOP sees a notice instead of its pages. A platform
  // admin is never locked out of the console this way.
  const suspended = Boolean(subscription?.suspended_at) && !isAdmin;

  return (
    <ShopFormatProvider value={shopFormat}>
      <div className="relative flex h-screen w-full flex-col overflow-hidden md:flex-row">
        <Sidebar
          profile={profile}
          shopName={shopSettings?.shop_name}
          shopLogoUrl={shopSettings?.shop_logo_url}
          shopSlug={liveSlug}
          isPlatformAdmin={isAdmin}
          plan={access.plan}
          storefrontNeedsAddress={storefrontNeedsAddress}
        />
        <MobileTopBar
          profile={profile}
          shopName={shopSettings?.shop_name}
          shopLogoUrl={shopSettings?.shop_logo_url}
        />
        {/* relative: every positioned element inside (visually hidden inputs,
            badges) stays within the scrolling content instead of stretching
            the whole document; overscroll-contain: reaching the end of a long
            page (Settings) no longer scrolls the sidebar along with it. */}
        <main className="relative w-full flex-1 overflow-y-auto overscroll-contain bg-background px-4 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-8 md:pt-8 md:pb-8">
          {suspended ? (
            <ShopSuspended reason={subscription?.suspension_reason ?? null} />
          ) : (
            <>
              <ShopMessages messages={messages} />
              <PlanBanner access={access} isManager={isManager} />
              {children}
            </>
          )}
        </main>
        <MobileTabBar profile={profile} shopSlug={liveSlug} isPlatformAdmin={isAdmin} plan={access.plan} storefrontNeedsAddress={storefrontNeedsAddress} />
        <Toaster />
      </div>
    </ShopFormatProvider>
  );
}

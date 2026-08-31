import Sidebar from "@/components/layout/Sidebar";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopSettings } from "@/features/settings/actions";

// Shared chrome (Sidebar + content area) for every authenticated dashboard
// page. Public pages (login, storefront, procurement intake) live outside
// this route group and never render this layout.
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
      <main className="w-full flex-1 overflow-y-auto bg-white p-4 pt-16 dark:bg-black md:p-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}

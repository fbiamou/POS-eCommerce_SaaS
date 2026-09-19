import { notFound } from "next/navigation";
import { getPublicShopProfile, getPublicShopCatalog } from "@/features/storefront/actions";
import StorefrontShop from "@/features/storefront/components/StorefrontShop";
import { ThemeStyle } from "@/components/ThemeStyle";

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const shop = await getPublicShopProfile(slug);
  if (!shop) notFound();

  const products = await getPublicShopCatalog(slug);

  return (
    <>
      {/* Only the storefront lets a shop customize its own look — the admin
          app keeps a fixed identity, set in globals.css. */}
      <ThemeStyle accentColor={shop.theme_accent_color} fontFamily={shop.theme_font} />
      <StorefrontShop shop={shop} products={products} />
    </>
  );
}

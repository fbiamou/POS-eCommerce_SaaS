import { notFound } from "next/navigation";
import { getPublicShopProfile, getPublicShopCatalog } from "@/features/storefront/actions";
import StorefrontShop from "@/features/storefront/components/StorefrontShop";
import { ThemeStyle } from "@/components/ThemeStyle";

// A shop's storefront is its own site for its own customers: it carries the
// shop's name alone, never the platform's.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getPublicShopProfile(slug);
  return { title: { absolute: shop?.shop_name || slug } };
}

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
      <StorefrontShop slug={slug} shop={shop} products={products} />
    </>
  );
}

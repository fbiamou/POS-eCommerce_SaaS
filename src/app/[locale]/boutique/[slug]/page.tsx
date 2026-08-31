import { notFound } from "next/navigation";
import { getPublicShopProfile, getPublicShopCatalog } from "@/features/storefront/actions";
import StorefrontShop from "@/features/storefront/components/StorefrontShop";

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const shop = await getPublicShopProfile(slug);
  if (!shop) notFound();

  const products = await getPublicShopCatalog(slug);

  return <StorefrontShop shop={shop} products={products} />;
}

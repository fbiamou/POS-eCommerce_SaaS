import ProductList from "@/features/stock/components/ProductList";
import { AddProductButton } from "@/features/stock/components/AddProductButton";
import { StockActions } from "@/features/stock/components/StockActions";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getShopSettings } from "@/features/settings/queries";
import { Link } from "@/i18n/routing";
import { AlertTriangle } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("Stock");
  return { title: t("title") };
}

export default async function StockPage() {
  const [t, shopSettings] = await Promise.all([
    getTranslations("Stock"),
    getShopSettings(),
  ]);
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      brand,
      product_type,
      quantity_in_stock,
      purchase_price,
      selling_price,
      is_active,
      description,
      image_url,
      is_published_online,
      categories(name)
    `)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erreur chargement stock:", error);
  }

  // Normalize to match ProductList's expected shape
  const normalizedProducts = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    product_type: p.product_type,
    quantity_in_stock: p.quantity_in_stock,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    description: p.description,
    image_url: p.image_url,
    is_published_online: p.is_published_online,
    category: (p.categories as unknown as { name: string } | null) ?? null,
  }));

  const hasPublishedProducts = normalizedProducts.some((p) => p.is_published_online);
  const showNoSlugWarning = hasPublishedProducts && !shopSettings?.shop_slug;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <StockActions />
          <AddProductButton label={t("add_product")} hasShopSlug={Boolean(shopSettings?.shop_slug)} />
        </div>
      </div>

      {showNoSlugWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            {t("no_slug_warning")}{" "}
            <Link href="/settings" className="font-medium underline">
              {t("no_slug_warning_link")}
            </Link>
          </p>
        </div>
      )}

      <ProductList products={normalizedProducts} hasShopSlug={Boolean(shopSettings?.shop_slug)} />
    </div>
  );
}

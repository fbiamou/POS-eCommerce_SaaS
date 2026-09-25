import ProductList from "@/features/stock/components/ProductList";
import { AddProductButton } from "@/features/stock/components/AddProductButton";
import { StockActions } from "@/features/stock/components/StockActions";
import { StockSummary } from "@/features/stock/components/StockSummary";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getShopSettings } from "@/features/settings/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { Link } from "@/i18n/routing";
import { AlertTriangle } from "lucide-react";
import { getShopAccess } from "@/features/billing/access";
import { PLAN_LIMITS } from "@/features/billing/plans";

export async function generateMetadata() {
  const t = await getTranslations("Stock");
  return { title: t("title") };
}

export default async function StockPage() {
  const [t, shopSettings, allSuppliers] = await Promise.all([
    getTranslations("Stock"),
    getShopSettings(),
    getSuppliers(),
  ]);
  const suppliers = allSuppliers.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      brand,
      product_type,
      supplier_id,
      origin_country,
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
    supplier_id: p.supplier_id,
    origin_country: p.origin_country,
    quantity_in_stock: p.quantity_in_stock,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    description: p.description,
    image_url: p.image_url,
    is_published_online: p.is_published_online,
    category: (p.categories as unknown as { name: string } | null) ?? null,
  }));


  // Each plan includes a number of items (Standard 100, Essentiel 500...).
  const access = await getShopAccess();
  const itemLimit = PLAN_LIMITS[access.plan].items;
  const tPlans = await getTranslations("Plans");

  const hasPublishedProducts = normalizedProducts.some((p) => p.is_published_online);
  const showNoSlugWarning = hasPublishedProducts && !shopSettings?.shop_slug;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
        <AddProductButton label={t("add_product")} hasShopSlug={Boolean(shopSettings?.shop_slug)} suppliers={suppliers} itemLimit={itemLimit} />
      </div>

      <StockSummary serverProducts={normalizedProducts} itemLimit={itemLimit} />

      {itemLimit !== null && normalizedProducts.length >= itemLimit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-900/40">
          <p>{tPlans("limit_items", { plan: tPlans(`plan_${access.plan}`), limit: itemLimit })}</p>
          <Link href="/settings?tab=formule" className="font-bold underline underline-offset-2">{tPlans("locked_cta")}</Link>
        </div>
      )}

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

      <ProductList products={normalizedProducts} hasShopSlug={Boolean(shopSettings?.shop_slug)} suppliers={suppliers} />

      <StockActions />
    </div>
  );
}

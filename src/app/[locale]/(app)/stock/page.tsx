import ProductList from "@/features/stock/components/ProductList";
import { AddProductButton } from "@/features/stock/components/AddProductButton";
import { StockActions } from "@/features/stock/components/StockActions";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";

export default async function StockPage() {
  const t = await getTranslations("Stock");
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
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
    quantity_in_stock: p.quantity_in_stock,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    description: p.description,
    image_url: p.image_url,
    is_published_online: p.is_published_online,
    category: p.categories ? { name: (p.categories as any).name } : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <StockActions />
          <AddProductButton label={t("add_product")} />
        </div>
      </div>

      <ProductList products={normalizedProducts} />
    </div>
  );
}

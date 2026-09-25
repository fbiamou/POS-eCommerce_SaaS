import CreateSaleForm from "@/features/sales/components/CreateSaleForm";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getShopSettings } from "@/features/settings/queries";
import { loyaltyCard, type LoyaltyInvoice } from "@/features/clients/loyalty";

export async function generateMetadata() {
  const t = await getTranslations("Sales");
  return { title: t("title") };
}

export default async function SalesPage() {
  const t = await getTranslations("Sales");
  const supabase = await createClient();
  const shopSettings = await getShopSettings();

  // Fetch real products from DB
  const { data: productsData } = await supabase
    .from("products")
    .select(`
      id,
      name,
      brand,
      product_type,
      selling_price,
      quantity_in_stock,
      image_url,
      categories(name)
    `)
    .eq("is_active", true)
    .gt("quantity_in_stock", 0)
    .order("name", { ascending: true });

  // Fetch real clients from DB
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, invoices(status, loyalty_reward_used)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Normalize products to match CreateSaleForm's Product type
  const products = (productsData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: (p.categories as unknown as { name: string } | null)?.name ?? "",
    sub_category: p.product_type ?? "",
    brand: p.brand ?? "",
    selling_price: p.selling_price,
    quantity_in_stock: p.quantity_in_stock,
    image_url: p.image_url,
  }));

  const loyalty = {
    enabled: shopSettings?.loyalty_enabled ?? true,
    stampsRequired: shopSettings?.loyalty_stamps_required ?? 10,
    rewardPercent: shopSettings?.loyalty_reward_percent ?? 10,
  };

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    card: loyaltyCard((c.invoices ?? []) as LoyaltyInvoice[], loyalty.stampsRequired, loyalty.enabled),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <CreateSaleForm
        products={products}
        clients={clients}
        defaultPhoneCountryCode={shopSettings?.default_phone_country_code || "+237"}
        loyalty={loyalty}
      />
    </div>
  );
}

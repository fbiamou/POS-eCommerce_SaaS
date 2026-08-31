import CreateSaleForm from "@/features/sales/components/CreateSaleForm";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";

export default async function SalesPage() {
  const t = await getTranslations("Sales");
  const supabase = await createClient();

  // Fetch real products from DB
  const { data: productsData } = await supabase
    .from("products")
    .select(`
      id,
      name,
      selling_price,
      quantity_in_stock,
      categories(name)
    `)
    .eq("is_active", true)
    .gt("quantity_in_stock", 0)
    .order("name", { ascending: true });

  // Fetch real clients from DB
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Normalize products to match CreateSaleForm's Product type
  const products = (productsData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: (p.categories as any)?.name ?? "",
    sub_category: "",
    brand: "",
    selling_price: p.selling_price,
    quantity_in_stock: p.quantity_in_stock,
  }));

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <CreateSaleForm products={products} clients={clients} />
    </div>
  );
}

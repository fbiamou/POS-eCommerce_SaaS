import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { productsToCsv } from "@/features/stock/csv";

export async function GET() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("name, brand, product_type, origin_country, purchase_price, selling_price, quantity_in_stock, image_url, is_published_online, categories(name), suppliers(name)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("CSV export failed:", error);
    return NextResponse.json({ error: "generic_error" }, { status: 500 });
  }

  const rows = (products ?? []).map((p) => ({
    name: p.name,
    brand: p.brand,
    product_type: p.product_type,
    origin_country: p.origin_country,
    supplier: (p.suppliers as unknown as { name: string } | null)?.name ?? "",
    category: (p.categories as unknown as { name: string } | null)?.name ?? "",
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    quantity_in_stock: p.quantity_in_stock,
    image_url: p.image_url,
    is_published_online: p.is_published_online,
  }));

  return new NextResponse(productsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stock.csv"',
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { productsToRows, stockLocale } from "@/features/stock/csv";
import { buildXlsx } from "@/lib/xlsx";

// The shop's items as an Excel workbook, in the import format and in its
// language (?locale=): edit it and import it back.
export async function GET(request: NextRequest) {
  const locale = stockLocale(request.nextUrl.searchParams.get("locale"));
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

  const t = await getTranslations({ locale, namespace: "StockTemplate" });
  const workbook = buildXlsx([{ name: t("sheet_items"), rows: productsToRows(rows, locale) }]);
  return new NextResponse(Buffer.from(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t("file_export")}.xlsx"`,
    },
  });
}

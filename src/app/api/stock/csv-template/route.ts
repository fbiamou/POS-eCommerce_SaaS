import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { stockLocale, templateRows } from "@/features/stock/csv";
import { buildXlsx } from "@/lib/xlsx";

// The stock template, as an Excel workbook in the shop's language (?locale=):
// the items to fill in, and a sheet explaining each column. An .xlsx opens in
// columns in every spreadsheet, whatever its list separator (a CSV did not).
export async function GET(request: NextRequest) {
  const locale = stockLocale(request.nextUrl.searchParams.get("locale"));
  const t = await getTranslations({ locale, namespace: "StockTemplate" });
  const help = [
    [t("help_column"), t("help_meaning")],
    ...(["name", "category", "type", "brand", "purchase_price", "selling_price", "quantity", "image_url", "online", "supplier", "origin_country"] as const).map(
      (column, i) => [String(templateRows(locale)[0][i]), t(`help_${column}`)],
    ),
    [],
    [t("help_image_title"), t("help_image_body")],
  ];
  const workbook = buildXlsx([
    { name: t("sheet_items"), rows: templateRows(locale) },
    { name: t("sheet_help"), rows: help },
  ]);
  return new NextResponse(Buffer.from(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t("file_template")}.xlsx"`,
    },
  });
}

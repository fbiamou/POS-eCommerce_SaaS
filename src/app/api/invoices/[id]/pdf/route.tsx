import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { getInvoiceDetail } from "@/features/invoices/actions";
import { getShopSettings } from "@/features/settings/queries";
import { routing } from "@/i18n/routing";
import { InvoiceDocument, type InvoiceLabels } from "@/features/invoices/components/InvoiceDocument";
import { taxIdLabelFor } from "@/lib/countries";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await getInvoiceDetail(id);
  if (!invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const shop = await getShopSettings();

  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const locale = routing.locales.find((l) => l === requestedLocale) ?? routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Invoices" });

  const labels: InvoiceLabels = {
    title: t("title"),
    invoice_number: t("invoice_number"),
    date: t("date"),
    client: t("client"),
    walk_in_client: t("walk_in_client"),
    article: t("article"),
    quantity: t("quantity"),
    unit_price: t("unit_price"),
    total: t("total"),
    subtotal_ht: t("subtotal_ht"),
    vat: t("vat"),
    total_ttc: t("total_ttc"),
    paid_amount: t("paid_amount"),
    remaining_due: t("remaining_due"),
    status: t("status"),
    status_paid: t("status_paid"),
    status_partial: t("status_partial"),
    status_unpaid: t("status_unpaid"),
    tax_id_label: taxIdLabelFor(shop?.country_code) ?? t("tax_id_label"),
    trade_register_label: t("trade_register_label"),
    shop_fallback: t("shop_fallback"),
  };

  const buffer = await renderToBuffer(
    <InvoiceDocument invoice={invoice} shop={shop} labels={labels} locale={locale} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number || invoice.id}.pdf"`,
    },
  });
}

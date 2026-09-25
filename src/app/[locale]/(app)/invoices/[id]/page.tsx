import { getTranslations } from "next-intl/server";
import { getInvoiceDetail } from "@/features/invoices/actions";
import { getShopSettings } from "@/features/settings/queries";
import { InvoiceView, type InvoiceShop } from "@/features/invoices/components/InvoiceView";
import { getShopAccess } from "@/features/billing/access";
import { planAllows } from "@/features/billing/plans";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, invoice] = await Promise.all([getTranslations("Invoices"), getInvoiceDetail(id)]);
  return { title: invoice?.invoice_number ? `${t("title")} ${invoice.invoice_number}` : t("title") };
}

// The server sends what it knows; the page itself (InvoiceView) prefers the
// device's copy, so an invoice made offline, unknown to the server yet, opens
// too. An unknown id is not an error page for the same reason.
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const [invoice, shop, access] = await Promise.all([getInvoiceDetail(id), getShopSettings(), getShopAccess()]);

  return <InvoiceView server={invoice} shop={invoiceShop(shop)} pdfAllowed={planAllows(access.plan, "invoice_pdf")} locale={locale} />;
}

function invoiceShop(shop: Awaited<ReturnType<typeof getShopSettings>>): InvoiceShop | null {
  if (!shop) return null;
  const { shop_name, shop_address, shop_phone, vat_registered, vat_rate_bps, tax_id, trade_register, country_code } = shop;
  return { shop_name, shop_address, shop_phone, vat_registered, vat_rate_bps, tax_id, trade_register, country_code };
}

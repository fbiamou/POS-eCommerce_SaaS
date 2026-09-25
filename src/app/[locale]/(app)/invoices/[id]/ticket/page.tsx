import { getTranslations } from "next-intl/server";
import { getInvoiceDetail } from "@/features/invoices/actions";
import { getShopSettings } from "@/features/settings/queries";
import { TicketView } from "@/features/invoices/components/TicketView";

export async function generateMetadata() {
  const t = await getTranslations("Invoices");
  return { title: t("ticket_title") };
}

// Same rule as the invoice page: the ticket prints from the device's copy
// when there is one (a sale made offline), otherwise from the server's.
export default async function InvoiceTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, shop] = await Promise.all([getInvoiceDetail(id), getShopSettings()]);

  return (
    <TicketView
      server={invoice}
      shop={
        shop
          ? {
              shop_name: shop.shop_name,
              shop_address: shop.shop_address,
              shop_phone: shop.shop_phone,
              vat_registered: shop.vat_registered,
              vat_rate_bps: shop.vat_rate_bps,
              tax_id: shop.tax_id,
              trade_register: shop.trade_register,
              country_code: shop.country_code,
            }
          : null
      }
    />
  );
}

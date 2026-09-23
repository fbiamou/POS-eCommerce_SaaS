import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getInvoiceDetail } from "@/features/invoices/actions";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { PrintButton } from "@/features/invoices/components/PrintButton";

export async function generateMetadata() {
  const t = await getTranslations("Invoices");
  return { title: t("ticket_title") };
}

export default async function InvoiceTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [t, invoice, shop, fmt] = await Promise.all([
    getTranslations("Invoices"),
    getInvoiceDetail(id),
    getShopSettings(),
    getFormatters(),
  ]);

  if (!invoice) notFound();

  const remaining = invoice.total_amount - invoice.paid_amount;
  const invoiceDate = fmt.date(invoice.created_at, "dateTime");
  const format = fmt.money;

  const statusLabel = {
    PAID: t("status_paid"),
    PARTIAL: t("status_partial"),
    UNPAID: t("status_unpaid"),
  }[invoice.status];

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <Link href={`/invoices/${invoice.id}`} className="flex items-center gap-1 text-sm text-zinc-500 hover:underline">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      <div className="printable-ticket mx-auto w-[80mm] bg-white p-3 font-mono text-[11px] leading-tight text-black">
        <div className="text-center">
          <p className="text-sm font-bold">{shop?.shop_name || t("shop_fallback")}</p>
          {shop?.shop_address && <p>{shop.shop_address}</p>}
          {shop?.shop_phone && <p>{shop.shop_phone}</p>}
          {shop?.tax_id && <p>NIU: {shop.tax_id}</p>}
          {shop?.trade_register && <p>RCCM: {shop.trade_register}</p>}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <p>{t("ticket_title")}{invoice.invoice_number ? ` ${invoice.invoice_number}` : ""}</p>
        <p>{invoiceDate}</p>
        <p>{t("client")}: {invoice.client?.name || t("walk_in_client")}</p>

        <div className="my-2 border-t border-dashed border-black" />

        {invoice.items.map((item) => (
          <div key={item.id} className="mb-1">
            <p>{item.product_name}</p>
            <div className="flex justify-between">
              <span>{item.quantity} x {format(item.unit_price)}</span>
              <span>{format(item.total_price)}</span>
            </div>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black" />

        <div className="flex justify-between font-bold">
          <span>{t("total_ttc")}</span>
          <span>{format(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("paid_amount")}</span>
          <span>{format(invoice.paid_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("remaining_due")}</span>
          <span>{format(remaining)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("status")}</span>
          <span>{statusLabel}</span>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <p className="text-center">{t("thank_you")}</p>
      </div>
    </div>
  );
}

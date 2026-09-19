import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getInvoiceDetail, extractVat } from "@/features/invoices/actions";
import { getShopSettings } from "@/features/settings/actions";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  const [t, invoice, shop] = await Promise.all([
    getTranslations("Invoices"),
    getInvoiceDetail(id),
    getShopSettings(),
  ]);

  if (!invoice) notFound();

  const currencySymbol = shop?.currency_symbol || "FCFA";
  const vatRateBps = shop?.vat_rate_bps ?? 1925;
  const { excludingVat, vatAmount } = shop?.vat_registered
    ? extractVat(invoice.total_amount, vatRateBps)
    : { excludingVat: invoice.total_amount, vatAmount: 0 };
  const remaining = invoice.total_amount - invoice.paid_amount;

  const statusLabel = {
    PAID: t("status_paid"),
    PARTIAL: t("status_partial"),
    UNPAID: t("status_unpaid"),
  }[invoice.status];

  const format = (n: number) => `${n.toLocaleString("fr-FR")} ${currencySymbol}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("title")}
          {invoice.invoice_number ? ` — ${invoice.invoice_number}` : ""}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/invoices/${invoice.id}/ticket`}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4" /> {t("print_ticket")}
          </Link>
          <a
            href={`/api/invoices/${invoice.id}/pdf?locale=${locale}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
          >
            <Download className="h-4 w-4" /> {t("download_pdf")}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex justify-between text-sm">
          <div>
            <p className="font-semibold">{shop?.shop_name || "Boutique"}</p>
            {shop?.shop_address && <p className="text-zinc-500">{shop.shop_address}</p>}
            {shop?.shop_phone && <p className="text-zinc-500">{shop.shop_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-zinc-500">{t("date")}</p>
            <p>{new Date(invoice.created_at).toLocaleDateString(locale)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-500">{t("client")}</p>
          <p>{invoice.client?.name || t("walk_in_client")}</p>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b text-zinc-500">
            <tr>
              <th className="py-2 font-medium">{t("article")}</th>
              <th className="py-2 text-right font-medium">{t("quantity")}</th>
              <th className="py-2 text-right font-medium">{t("unit_price")}</th>
              <th className="py-2 text-right font-medium">{t("total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.product_name}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{format(item.unit_price)}</td>
                <td className="py-2 text-right">{format(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          {shop?.vat_registered && (
            <>
              <div className="flex justify-between text-zinc-500">
                <span>{t("subtotal_ht")}</span>
                <span>{format(excludingVat)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>
                  {t("vat")} ({(vatRateBps / 100).toFixed(2)}%)
                </span>
                <span>{format(vatAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-1 font-bold">
            <span>{t("total_ttc")}</span>
            <span>{format(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>{t("paid_amount")}</span>
            <span>{format(invoice.paid_amount)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>{t("remaining_due")}</span>
            <span>{format(remaining)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>{t("status")}</span>
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

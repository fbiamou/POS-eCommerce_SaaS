import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getInvoiceDetail, extractVat } from "@/features/invoices/actions";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { RecordPaymentButton } from "@/features/invoices/components/RecordPaymentButton";
import { INVOICE_STATUS_CLASS } from "@/features/invoices/status";
import { DebtProgress } from "@/components/ui/DebtProgress";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, invoice] = await Promise.all([getTranslations("Invoices"), getInvoiceDetail(id)]);
  return { title: invoice?.invoice_number ? `${t("title")} ${invoice.invoice_number}` : t("title") };
}

const secondaryButton =
  "flex items-center gap-2 rounded-xl bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-semibold text-zinc-800 shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-zinc-100 dark:text-zinc-200";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  const [t, invoice, shop, format] = await Promise.all([
    getTranslations("Invoices"),
    getInvoiceDetail(id),
    getShopSettings(),
    getFormatters(),
  ]);

  if (!invoice) notFound();

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/invoices" className="flex w-fit items-center gap-1.5 text-[14px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> {t("list_title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{invoice.client?.name || t("walk_in_client")}</h1>
          <p className="mt-1 flex items-center gap-2 font-mono text-[13px] text-zinc-500">
            {invoice.invoice_number || t("title")} · {format.date(invoice.created_at)}
            <span className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${INVOICE_STATUS_CLASS[invoice.status]}`}>{statusLabel}</span>
          </p>
        </div>
      </div>

      {remaining > 0 && (
        <section aria-label={t("remaining_due")} className="rounded-2xl bg-[var(--surface-1)] p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-zinc-500">{t("remaining_due")}</span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">{format.money(remaining)}</span>
          </div>
          <DebtProgress
            className="mt-3"
            paid={invoice.paid_amount}
            total={invoice.total_amount}
            label={t("paid_progress", { paid: format.money(invoice.paid_amount), total: format.money(invoice.total_amount) })}
          />
          <div className="mt-4">
            <RecordPaymentButton invoiceId={invoice.id} remaining={remaining} />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/invoices/${invoice.id}/ticket`} className={secondaryButton}>
          <Printer className="h-4 w-4" /> {t("print_ticket")}
        </Link>
        <a href={`/api/invoices/${invoice.id}/pdf?locale=${locale}`} target="_blank" rel="noreferrer" className={secondaryButton}>
          <Download className="h-4 w-4" /> {t("download_pdf")}
        </a>
      </div>

      <article className="flex flex-col gap-5 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap justify-between gap-4 text-[14px]">
          <div>
            <p className="font-display text-[17px] font-bold">{shop?.shop_name || t("shop_fallback")}</p>
            {shop?.shop_address && <p className="text-zinc-500">{shop.shop_address}</p>}
            {shop?.shop_phone && <p className="text-zinc-500">{shop.shop_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{t("client")}</p>
            <p className="font-semibold">{invoice.client?.name || t("walk_in_client")}</p>
            {invoice.client?.phone && <p className="font-mono text-[13px] text-zinc-500">{invoice.client.phone}</p>}
          </div>
        </div>

        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-[var(--line)] dark:border-[var(--line)]">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-[14px]">
              <div className="min-w-0">
                <p className="font-semibold">{item.product_name}</p>
                <p className="font-mono text-[12.5px] text-zinc-500 tabular-nums">
                  {item.quantity} × {format.money(item.unit_price)}
                </p>
              </div>
              <span className="shrink-0 font-mono font-semibold tabular-nums">{format.money(item.total_price)}</span>
            </li>
          ))}
        </ul>

        <dl className="ml-auto w-full max-w-xs space-y-1.5 text-[14px]">
          {shop?.vat_registered && (
            <>
              <div className="flex justify-between text-zinc-500">
                <dt>{t("subtotal_ht")}</dt>
                <dd className="font-mono tabular-nums">{format.money(excludingVat)}</dd>
              </div>
              <div className="flex justify-between text-zinc-500">
                <dt>{t("vat")} ({(vatRateBps / 100).toFixed(2)}%)</dt>
                <dd className="font-mono tabular-nums">{format.money(vatAmount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-[16px] font-bold dark:border-[var(--line)]">
            <dt>{t("total_ttc")}</dt>
            <dd className="font-mono tabular-nums">{format.money(invoice.total_amount)}</dd>
          </div>
          <div className="flex justify-between text-zinc-500">
            <dt>{t("paid_amount")}</dt>
            <dd className="font-mono tabular-nums">{format.money(invoice.paid_amount)}</dd>
          </div>
          <div className="flex justify-between text-zinc-500">
            <dt>{t("remaining_due")}</dt>
            <dd className="font-mono tabular-nums">{format.money(remaining)}</dd>
          </div>
        </dl>

        {invoice.payments.length > 0 && (
          <div className="border-t border-zinc-200 pt-4 text-[14px] dark:border-[var(--line)]">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{t("payments_history")}</p>
            <ul className="space-y-1.5">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3">
                  <span className="text-zinc-500">{format.date(payment.payment_date, "dateTime")}</span>
                  <span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{format.money(payment.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}

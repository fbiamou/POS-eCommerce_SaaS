"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, CloudOff, Download, Lock, Printer, TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { DebtProgress } from "@/components/ui/DebtProgress";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useOptionalOfflineContext } from "@/features/offline/OfflineProvider";
import type { InvoiceDetail } from "../actions";
import { INVOICE_STATUS_CLASS } from "../status";
import { extractVat } from "../vat";
import { RecordPaymentButton } from "./RecordPaymentButton";
import { useInvoiceView } from "./useInvoiceView";

export type InvoiceShop = {
  shop_name: string | null;
  shop_address: string | null;
  shop_phone: string | null;
  vat_registered: boolean;
  vat_rate_bps: number;
  tax_id: string | null;
  trade_register: string | null;
  country_code: string | null;
};

const secondaryButton =
  "flex items-center gap-2 rounded-xl bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-semibold text-zinc-800 shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-zinc-100 dark:text-zinc-200";

// The invoice page. It shows the device's copy of the invoice when there is
// one, so a sale made offline a minute ago opens like any other.
export function InvoiceView({
  server,
  shop,
  pdfAllowed,
  locale,
}: {
  server: InvoiceDetail | null;
  shop: InvoiceShop | null;
  pdfAllowed: boolean;
  locale: string;
}) {
  const t = useTranslations("Invoices");
  const tOffline = useTranslations("Offline");
  const format = useShopFormat();
  const offline = useOptionalOfflineContext();
  const online = offline ? offline.status.online : true;
  const { invoice, loading } = useInvoiceView(server);

  if (!invoice) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <Link href="/invoices" className="flex w-fit items-center gap-1.5 text-[14px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> {t("list_title")}
        </Link>
        <p className="rounded-2xl bg-[var(--surface-1)] p-6 text-center text-zinc-500 shadow-card">
          {loading ? tOffline("loading") : tOffline("not_on_device")}
        </p>
      </div>
    );
  }

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
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[13px] text-zinc-500">
            {invoice.invoice_number || t("title")} · {format.date(invoice.created_at)}
            <span className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${INVOICE_STATUS_CLASS[invoice.status]}`}>{statusLabel}</span>
            {invoice.local_state === "pending" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                <CloudOff className="h-3 w-3" /> {tOffline("badge_pending")}
              </span>
            )}
            {invoice.local_state === "failed" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <TriangleAlert className="h-3 w-3" /> {tOffline("badge_failed")}
              </span>
            )}
          </p>
          {invoice.seller_name && (
            <p className="mt-1 text-[13px] text-zinc-500">
              {t("served_by")} : <span className="font-semibold text-zinc-700 dark:text-zinc-300">{invoice.seller_name}</span>
            </p>
          )}
        </div>
      </div>

      {remaining > 0 && invoice.local_state !== "failed" && (
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
        {/* The PDF is made by the server: it needs the internet and an invoice it knows. */}
        {!pdfAllowed ? (
          <Link href="/locked/invoice_pdf" className={`${secondaryButton} opacity-70`}>
            <Lock className="h-4 w-4" /> {t("download_pdf")}
          </Link>
        ) : online && !invoice.local_state ? (
          <a href={`/api/invoices/${invoice.id}/pdf?locale=${locale}`} target="_blank" rel="noreferrer" className={secondaryButton}>
            <Download className="h-4 w-4" /> {t("download_pdf")}
          </a>
        ) : (
          <span title={tOffline("needs_connection")} className={`${secondaryButton} cursor-not-allowed opacity-50`}>
            <CloudOff className="h-4 w-4" /> {t("download_pdf")}
          </span>
        )}
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
          {invoice.discount_amount > 0 && (
            <>
              <div className="flex justify-between text-zinc-500">
                <dt>{t("subtotal")}</dt>
                <dd className="font-mono tabular-nums">{format.money(invoice.total_amount + invoice.discount_amount)}</dd>
              </div>
              <div className="flex justify-between font-semibold text-amber-800 dark:text-saffron">
                <dt>{t("loyalty_discount")}</dt>
                <dd className="font-mono tabular-nums">−{format.money(invoice.discount_amount)}</dd>
              </div>
            </>
          )}
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
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    {format.date(payment.payment_date, "dateTime")}
                    {payment.local_state === "pending" && <CloudOff className="h-3.5 w-3.5 text-amber-700" aria-label={tOffline("badge_pending")} />}
                    {payment.local_state === "failed" && <TriangleAlert className="h-3.5 w-3.5 text-red-600" aria-label={tOffline("badge_failed")} />}
                  </span>
                  <span className={`font-mono font-semibold tabular-nums ${payment.local_state === "failed" ? "text-zinc-400 line-through" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {format.money(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}

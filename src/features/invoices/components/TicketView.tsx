"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { taxIdLabelFor } from "@/lib/countries";
import type { InvoiceDetail } from "../actions";
import { extractVat } from "../vat";
import { PrintButton } from "./PrintButton";
import type { InvoiceShop } from "./InvoiceView";
import { useInvoiceView } from "./useInvoiceView";

// The WISHOP thread as a printed band: a zigzag with a lozenge, in solid
// black so it survives a thermal printer.
function ThreadBand() {
  return (
    <svg viewBox="0 0 280 14" preserveAspectRatio="none" aria-hidden="true" className="my-2 block h-3 w-full">
      <polyline
        points="0,11 10,3 20,11 30,3 40,11 50,3 60,11 70,3 80,11 90,3 100,11 110,3 120,11 130,3 140,11 150,3 160,11 170,3 180,11 190,3 200,11 210,3 220,11 230,3 240,11 250,3 260,11 270,3 280,11"
        fill="none"
        stroke="#000"
        strokeWidth="1.6"
      />
      <path d="M140 -1 L144 3 L140 7 L136 3Z" fill="#000" />
    </svg>
  );
}

// The 80 mm till ticket. It prints from the device's copy, so a sale made
// without internet gets its ticket at once, with its final number.
export function TicketView({ server, shop }: { server: InvoiceDetail | null; shop: InvoiceShop | null }) {
  const t = useTranslations("Invoices");
  const tOffline = useTranslations("Offline");
  const fmt = useShopFormat();
  const { invoice, loading } = useInvoiceView(server);

  if (!invoice) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        <Link href="/invoices" className="flex items-center gap-1.5 text-[14px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <p className="rounded-2xl bg-[var(--surface-1)] p-6 text-center text-zinc-500 shadow-card">
          {loading ? tOffline("loading") : tOffline("not_on_device")}
        </p>
      </div>
    );
  }

  const remaining = invoice.total_amount - invoice.paid_amount;
  const invoiceDate = fmt.date(invoice.created_at, "dateTime");
  const format = fmt.money;
  const vatRateBps = shop?.vat_rate_bps ?? 1925;
  const vat = shop?.vat_registered ? extractVat(invoice.total_amount, vatRateBps) : null;

  const statusLabel = {
    PAID: t("status_paid"),
    PARTIAL: t("status_partial"),
    UNPAID: t("status_unpaid"),
  }[invoice.status];

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <Link href={`/invoices/${invoice.id}`} className="flex items-center gap-1.5 text-[14px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      {/* Printed in black on thermal paper: no colour, no shadow. */}
      <div className="printable-ticket mx-auto w-[80mm] bg-white px-3 py-4 font-mono text-[11.5px] leading-snug text-black shadow-card print:shadow-none">
        <div className="text-center">
          <p className="font-display text-[17px] font-extrabold leading-tight tracking-tight">{shop?.shop_name || t("shop_fallback")}</p>
          {shop?.shop_address && <p>{shop.shop_address}</p>}
          {shop?.shop_phone && <p>{shop.shop_phone}</p>}
          {shop?.tax_id && <p>{taxIdLabelFor(shop.country_code) ?? t("tax_id_label")} : {shop.tax_id}</p>}
          {shop?.trade_register && <p>{t("trade_register_label")} : {shop.trade_register}</p>}
        </div>

        <ThreadBand />

        <div className="flex justify-between gap-2">
          <span>{t("ticket_title")}</span>
          <span className="font-bold">{invoice.invoice_number ?? ""}</span>
        </div>
        <p>{invoiceDate}</p>
        <p>{t("client")} : {invoice.client?.name || t("walk_in_client")}</p>
        {invoice.seller_name && <p>{t("served_by")} : {invoice.seller_name}</p>}

        <div className="my-2 border-t border-dashed border-black" />

        {invoice.items.map((item) => (
          <div key={item.id} className="mb-1.5">
            <p>{item.product_name}</p>
            <div className="flex justify-between">
              <span>{item.quantity} × {format(item.unit_price)}</span>
              <span>{format(item.total_price)}</span>
            </div>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black" />

        {invoice.discount_amount > 0 && (
          <>
            <div className="flex justify-between">
              <span>{t("subtotal")}</span>
              <span>{format(invoice.total_amount + invoice.discount_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("loyalty_discount")}</span>
              <span>−{format(invoice.discount_amount)}</span>
            </div>
          </>
        )}
        {vat && (
          <>
            <div className="flex justify-between">
              <span>{t("subtotal_ht")}</span>
              <span>{format(vat.excludingVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("vat")} {(vatRateBps / 100).toFixed(2)} %</span>
              <span>{format(vat.vatAmount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-[14px] font-bold">
          <span>{t("total_ttc")}</span>
          <span>{format(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("paid_amount")}</span>
          <span>{format(invoice.paid_amount)}</span>
        </div>
        {remaining > 0 ? (
          <div className="mt-1 flex justify-between border border-black px-1.5 py-1 font-bold">
            <span>{t("remaining_due")}</span>
            <span>{format(remaining)}</span>
          </div>
        ) : (
          <p className="mt-1 text-center font-bold">{statusLabel}</p>
        )}

        <ThreadBand />

        <p className="text-center">{t("thank_you")}</p>
      </div>
    </div>
  );
}

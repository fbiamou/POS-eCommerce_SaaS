"use client";

import type { InvoiceDetail } from "../actions";
import type { LocalState } from "@/features/offline/db";
import { useLocalInvoice, type LocalInvoiceDetail } from "@/features/offline/hooks";
import { useRouteId } from "@/features/offline/useRouteId";

export type ViewInvoice = Omit<InvoiceDetail, "payments"> & {
  payments: (InvoiceDetail["payments"][number] & { local_state?: LocalState })[];
  /** Made on this device and not sent yet, or refused by the server. */
  local_state?: LocalState;
  recorded_offline: boolean;
};

function fromLocal({ invoice, items, payments }: LocalInvoiceDetail): ViewInvoice {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    paid_amount: invoice.paid_amount,
    status: invoice.status,
    created_at: invoice.created_at,
    discount_amount: invoice.discount_amount,
    client: invoice.client_name ? { name: invoice.client_name, phone: invoice.client_phone } : null,
    seller_name: invoice.seller_name,
    items: items.map(({ id, quantity, unit_price, total_price, product_name }) => ({ id, quantity, unit_price, total_price, product_name })),
    payments: payments.map(({ id, amount, payment_date, local_state }) => ({ id, amount, payment_date, local_state })),
    local_state: invoice.local_state,
    recorded_offline: invoice.recorded_offline,
  };
}

/**
 * The invoice shown on its page and its ticket. The device's copy comes
 * first: it includes what was done here and not sent yet (a sale made
 * offline, a payment just taken). Otherwise the server's, as before.
 */
export function useInvoiceView(server: InvoiceDetail | null): { invoice: ViewInvoice | null; loading: boolean } {
  const id = useRouteId("invoices", server?.id ?? null);
  const local = useLocalInvoice(id);
  if (local) return { invoice: fromLocal(local), loading: false };
  if (server && server.id === id) return { invoice: { ...server, recorded_offline: false }, loading: false };
  return { invoice: null, loading: local === undefined };
}

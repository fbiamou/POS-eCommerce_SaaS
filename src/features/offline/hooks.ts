"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { LocalClient, LocalInvoice, LocalInvoiceItem, LocalPayment, LocalProduct } from "./db";
import { useOptionalOfflineContext } from "./OfflineProvider";

// The device's copy of the shop, for the screens. Each hook returns null
// while the device has no copy yet (first opening, before the first sync):
// the page then shows what the server sent, as before offline mode.

function useReadyDb() {
  const offline = useOptionalOfflineContext();
  return offline?.status.ready ? offline.db : null;
}

export function useLocalProducts(): LocalProduct[] | null {
  const db = useReadyDb();
  return useLiveQuery(async () => (db ? (await db.products.orderBy("name").toArray()).filter((p) => p.is_active) : null), [db], null);
}

export function useLocalClients(): LocalClient[] | null {
  const db = useReadyDb();
  return useLiveQuery(async () => (db ? (await db.clients.orderBy("name").toArray()).filter((c) => c.is_active) : null), [db], null);
}

/** Newest first, like the invoice list. */
export function useLocalInvoices(): LocalInvoice[] | null {
  const db = useReadyDb();
  return useLiveQuery(async () => (db ? await db.invoices.orderBy("created_at").reverse().toArray() : null), [db], null);
}

export type LocalInvoiceDetail = { invoice: LocalInvoice; items: LocalInvoiceItem[]; payments: LocalPayment[] };

/**
 * One invoice with its lines and payments. `undefined` while reading, `null`
 * when the device does not have it (not synced yet, or another shop's).
 */
export function useLocalInvoice(id: string | null): LocalInvoiceDetail | null | undefined {
  const offline = useOptionalOfflineContext();
  const db = offline?.db ?? null;
  return useLiveQuery(
    async () => {
      if (!db || !id) return null;
      const invoice = await db.invoices.get(id);
      if (!invoice) return null;
      const [items, payments] = await Promise.all([
        db.invoice_items.where("invoice_id").equals(id).toArray(),
        db.payments.where("invoice_id").equals(id).toArray(),
      ]);
      payments.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
      return { invoice, items, payments };
    },
    [db, id],
    undefined
  );
}

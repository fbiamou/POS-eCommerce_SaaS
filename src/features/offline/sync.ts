import type { FeedbackCode } from "@/lib/feedback";
import {
  getMeta,
  setMeta,
  type ClientPayload,
  type LocalClient,
  type LocalInvoice,
  type LocalInvoiceItem,
  type LocalMember,
  type LocalSupplier,
  type ProductCreatePayload,
  type ProductUpdatePayload,
  type PurchaseOrderReceivePayload,
  purchaseOrderMarker,
  type LocalPayment,
  type LocalProduct,
  type OutboxEntry,
  type PaymentPayload,
  type SalePayload,
  type ShopDatabase,
} from "./db";
import { invoiceStatus, soldQuantities } from "./records";

// Sync between the phone and the server, in two directions:
//  - push: the outbox is sent in order, through the same database functions
//    as online. An id made on the phone makes a second sending harmless.
//  - pull: rows changed on the server since the last pull replace the local
//    copy. What the phone did and has not sent yet is laid on top (stock
//    already sold, debts already paid), so nothing jumps back.

export type Outcome<T> = { ok: true; data: T } | { ok: false; network: boolean; code: FeedbackCode };

export type ServerInvoice = LocalInvoice & {
  updated_at: string;
  items: LocalInvoiceItem[];
  payments: LocalPayment[];
};

export type ShopSnapshot = {
  shop_name: string | null;
  shop_phone: string | null;
  shop_address: string | null;
  shop_email: string | null;
  shop_logo_url: string | null;
  tax_id: string | null;
  trade_register: string | null;
  country_code: string | null;
  vat_registered: boolean;
  vat_rate_bps: number;
  currency_symbol: string;
  default_phone_country_code: string;
  low_stock_threshold: number;
  timezone: string;
  loyalty_enabled: boolean;
  loyalty_stamps_required: number;
  loyalty_reward_percent: number;
};

export interface SyncBackend {
  recordClient(payload: ClientPayload, offline: boolean): Promise<Outcome<null>>;
  recordSale(payload: SalePayload, offline: boolean): Promise<Outcome<null>>;
  recordPayment(payload: PaymentPayload, offline: boolean): Promise<Outcome<null>>;
  /** Rows changed since `since` (everything when null), oldest change first. */
  pullProducts(since: string | null): Promise<Outcome<(LocalProduct & { updated_at: string })[]>>;
  pullClients(since: string | null): Promise<Outcome<(LocalClient & { updated_at: string })[]>>;
  pullInvoices(since: string | null): Promise<Outcome<ServerInvoice[]>>;
  pullShop(): Promise<Outcome<ShopSnapshot | null>>;
  /** The whole team (a few rows): names and till code fingerprints. */
  pullMembers(): Promise<Outcome<LocalMember[]>>;
  pullSuppliers(): Promise<Outcome<LocalSupplier[]>>;
  recordProduct(payload: ProductCreatePayload, offline: boolean): Promise<Outcome<null>>;
  updateProductOffline(payload: ProductUpdatePayload): Promise<Outcome<null>>;
  receivePurchaseOrderOffline(payload: PurchaseOrderReceivePayload): Promise<Outcome<null>>;
}

export type PushResult = { sent: number; failed: number; offline: boolean };

export async function pushOutbox(db: ShopDatabase, backend: SyncBackend): Promise<PushResult> {
  const entries = await db.outbox.where("state").equals("pending").sortBy("seq");
  const result: PushResult = { sent: 0, failed: 0, offline: false };

  for (const entry of entries) {
    const outcome = await send(backend, entry);
    if (outcome.ok) {
      await markSent(db, entry);
      result.sent++;
      continue;
    }
    if (outcome.network) {
      // No connection (or the server is busy): stop here and keep the order.
      result.offline = true;
      break;
    }
    await markFailed(db, entry, outcome.code);
    result.failed++;
  }
  return result;
}

function send(backend: SyncBackend, entry: OutboxEntry): Promise<Outcome<null>> {
  switch (entry.kind) {
    case "client":
      return backend.recordClient(entry.payload, entry.offline);
    case "sale":
      return backend.recordSale(entry.payload, entry.offline);
    case "payment":
      return backend.recordPayment(entry.payload, entry.offline);
    case "product_create":
      return backend.recordProduct(entry.payload, entry.offline);
    case "product_update":
      return backend.updateProductOffline(entry.payload);
    case "po_receive":
      return backend.receivePurchaseOrderOffline(entry.payload);
  }
}

function tableOf(db: ShopDatabase, entry: OutboxEntry) {
  switch (entry.kind) {
    case "client":
      return db.clients;
    case "sale":
      return db.invoices;
    case "payment":
      return db.payments;
    default:
      return db.products;
  }
}

async function markSent(db: ShopDatabase, entry: OutboxEntry) {
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.payments, db.products, db.meta], async () => {
    if (entry.seq !== undefined) await db.outbox.delete(entry.seq);
    if (entry.kind === "po_receive") {
      await db.meta.delete(purchaseOrderMarker(entry.payload.order_id));
      return;
    }
    await tableOf(db, entry).update(entry.ref_id, { local_state: undefined });
  });
}

// Refused by the server (the sale names an item removed meanwhile, a debt
// was already paid on another phone...). The operation stays visible « à
// vérifier » for the owner, and what it had changed on the phone is undone.
async function markFailed(db: ShopDatabase, entry: OutboxEntry, code: FeedbackCode) {
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.payments, db.products, db.meta], async () => {
    if (entry.seq !== undefined) {
      await db.outbox.update(entry.seq, { state: "failed", error: code, attempts: entry.attempts + 1 });
    }
    if (entry.kind === "po_receive") {
      // The delivery did not enter the stock: the device's count goes back.
      for (const line of entry.payload.stock) {
        const product = await db.products.get(line.product_id);
        if (product) await db.products.update(line.product_id, { quantity_in_stock: product.quantity_in_stock - line.quantity });
      }
      await db.meta.delete(purchaseOrderMarker(entry.payload.order_id));
      return;
    }
    if (entry.kind === "client") {
      await db.clients.update(entry.ref_id, { local_state: "failed" });
    } else if (entry.kind === "sale") {
      await db.invoices.update(entry.ref_id, { local_state: "failed" });
      for (const [productId, quantity] of soldQuantities(entry.payload.items)) {
        const product = await db.products.get(productId);
        if (product) await db.products.update(productId, { quantity_in_stock: product.quantity_in_stock + quantity });
      }
    } else if (entry.kind === "payment") {
      await db.payments.update(entry.ref_id, { local_state: "failed" });
      const invoice = await db.invoices.get(entry.payload.invoice_id);
      if (invoice) {
        const paid = Math.max(0, invoice.paid_amount - entry.payload.amount);
        await db.invoices.update(invoice.id, { paid_amount: paid, status: invoiceStatus(paid, invoice.total_amount) });
      }
    } else if (entry.kind === "product_create") {
      await db.products.update(entry.ref_id, { local_state: "failed" });
    } else {
      // The item goes back to how it was, minus the stock change only: sales
      // made on the device since then stay counted.
      const current = await db.products.get(entry.ref_id);
      if (current) {
        await db.products.put({
          ...entry.payload.before,
          quantity_in_stock: current.quantity_in_stock - entry.payload.stock_delta,
          local_state: "failed",
        });
      }
    }
  });
}

/** What the phone did and has not sent yet, to lay over the server's rows. */
async function pendingOverlay(db: ShopDatabase) {
  const pending = await db.outbox.where("state").equals("pending").toArray();
  // Stock taken by sales, or changed by counts, not sent yet.
  const sold = new Map<string, number>();
  const paid = new Map<string, number>();
  for (const entry of pending) {
    if (entry.kind === "po_receive") {
      for (const line of entry.payload.stock) sold.set(line.product_id, (sold.get(line.product_id) ?? 0) - line.quantity);
    } else if (entry.kind === "product_update" && entry.payload.stock_delta !== 0) {
      sold.set(entry.payload.product_id, (sold.get(entry.payload.product_id) ?? 0) - entry.payload.stock_delta);
    } else if (entry.kind === "sale") {
      for (const [productId, quantity] of soldQuantities(entry.payload.items)) {
        sold.set(productId, (sold.get(productId) ?? 0) + quantity);
      }
    } else if (entry.kind === "payment") {
      paid.set(entry.payload.invoice_id, (paid.get(entry.payload.invoice_id) ?? 0) + entry.payload.amount);
    }
  }
  return { sold, paid };
}

const CURSOR = {
  products: "cursor:products",
  clients: "cursor:clients",
  invoices: "cursor:invoices",
} as const;

function omit<T extends object, K extends keyof T>(row: T, keys: K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function latest(rows: { updated_at: string }[], previous: string | null) {
  return rows.reduce<string | null>((max, row) => (max === null || row.updated_at > max ? row.updated_at : max), previous);
}

export type PullResult = { ok: true } | { ok: false; network: boolean };

/**
 * Brings the phone's copy up to date. `full` reloads every item and customer
 * (once per session, to catch a renamed category), invoices stay incremental.
 */
export async function pullChanges(db: ShopDatabase, backend: SyncBackend, options: { full?: boolean } = {}): Promise<PullResult> {
  const since = async (key: string) => (options.full ? null : ((await getMeta<string>(db, key)) ?? null));
  const cursors = {
    products: await since(CURSOR.products),
    clients: await since(CURSOR.clients),
    // Invoices never start again from the beginning: the history can be long
    // and each change to an invoice (a payment) already moves its date.
    invoices: (await getMeta<string>(db, CURSOR.invoices)) ?? null,
  };

  const [shop, products, clients, invoices, members, suppliers] = await Promise.all([
    backend.pullShop(),
    backend.pullProducts(cursors.products),
    backend.pullClients(cursors.clients),
    backend.pullInvoices(cursors.invoices),
    backend.pullMembers(),
    backend.pullSuppliers(),
  ]);
  for (const outcome of [shop, products, clients, invoices, members, suppliers]) {
    if (!outcome.ok) return { ok: false, network: outcome.network };
  }
  if (!shop.ok || !products.ok || !clients.ok || !invoices.ok || !members.ok || !suppliers.ok) return { ok: false, network: true };

  await db.transaction(
    "rw",
    [db.meta, db.products, db.clients, db.invoices, db.invoice_items, db.payments, db.outbox, db.members, db.suppliers],
    async () => {
    const overlay = await pendingOverlay(db);

    if (shop.data) await setMeta(db, "shop", shop.data);
    // The team is small: replaced as a whole, so a removed code disappears.
    await db.members.clear();
    await db.members.bulkPut(members.data);
    await db.suppliers.clear();
    await db.suppliers.bulkPut(suppliers.data);

    await db.products.bulkPut(
      products.data.map((row) => ({
        ...omit(row, ["updated_at"]),
        quantity_in_stock: row.quantity_in_stock - (overlay.sold.get(row.id) ?? 0),
      }))
    );

    // A customer created on the phone and not sent yet keeps its mark.
    const localClients = new Map((await db.clients.bulkGet(clients.data.map((c) => c.id))).filter(Boolean).map((c) => [c!.id, c!]));
    await db.clients.bulkPut(
      clients.data.map((row) => ({
        ...omit(row, ["updated_at"]),
        local_state: localClients.get(row.id)?.local_state === "pending" ? ("pending" as const) : undefined,
      }))
    );

    for (const row of invoices.data) {
      const { items, payments } = row;
      const invoice = omit(row, ["updated_at", "items", "payments"]);
      const extra = overlay.paid.get(invoice.id) ?? 0;
      const paid = Math.min(invoice.total_amount, invoice.paid_amount + extra);
      await db.invoices.put({ ...invoice, paid_amount: paid, status: invoiceStatus(paid, invoice.total_amount), local_state: undefined });
      await db.invoice_items.bulkPut(items);
      // Payments made on the phone and not sent yet stay, the others are the server's.
      const localPayments = await db.payments.where("invoice_id").equals(invoice.id).toArray();
      const serverIds = new Set(payments.map((p) => p.id));
      await db.payments.bulkDelete(localPayments.filter((p) => !p.local_state && !serverIds.has(p.id)).map((p) => p.id));
      await db.payments.bulkPut(payments);
    }

    await setMeta(db, CURSOR.products, latest(products.data, cursors.products));
    await setMeta(db, CURSOR.clients, latest(clients.data, cursors.clients));
    await setMeta(db, CURSOR.invoices, latest(invoices.data, cursors.invoices));
    await setMeta(db, "lastPullAt", new Date().toISOString());
    }
  );

  return { ok: true };
}

export type SyncResult = { push: PushResult; pull: PullResult | null };

/** Sends first, then receives: the server's answer then includes the phone's sales. */
export async function syncNow(db: ShopDatabase, backend: SyncBackend, options: { full?: boolean } = {}): Promise<SyncResult> {
  const push = await pushOutbox(db, backend);
  if (push.offline) return { push, pull: null };
  const pull = await pullChanges(db, backend, options);
  return { push, pull };
}

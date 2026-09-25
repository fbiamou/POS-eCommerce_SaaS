import Dexie, { type EntityTable } from "dexie";

// Local copy of the shop kept in the phone (IndexedDB), so the app keeps
// working when the power or the internet goes (decided 25/09/2026: the whole
// app works offline, not only the till). The server stays the reference:
// every change made on the phone goes through the outbox, is sent to the
// same database functions as online (record_sale, record_payment,
// record_client), then the next pull replaces the local copy.

export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";

/** Set on a row created on this phone and not yet accepted by the server. */
export type LocalState = "pending" | "failed";

export type LocalProduct = {
  id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  category_name: string | null;
  supplier_id: string | null;
  origin_country: string | null;
  quantity_in_stock: number;
  purchase_price: number;
  selling_price: number;
  description: string | null;
  image_url: string | null;
  is_published_online: boolean;
  is_active: boolean;
};

export type LocalClient = {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  local_state?: LocalState;
};

export type LocalInvoice = {
  id: string;
  invoice_number: string | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  total_amount: number;
  paid_amount: number;
  discount_amount: number;
  loyalty_reward_used: boolean;
  status: InvoiceStatus;
  created_at: string;
  recorded_offline: boolean;
  local_state?: LocalState;
};

export type LocalInvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type LocalPayment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  local_state?: LocalState;
};

export type SaleItemInput = { product_id: string; quantity: number; unit_price: number };

export type SalePayload = {
  invoice_id: string;
  client_id: string | null;
  items: SaleItemInput[];
  paid_amount: number;
  use_loyalty_reward: boolean;
  device_id: string;
  device_seq: number;
  /** Time of the sale on the phone; sent only when it was made offline. */
  sold_at: string;
};

export type PaymentPayload = {
  payment_id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
};

export type ClientPayload = {
  client_id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

export type OutboxOp =
  | { kind: "client"; payload: ClientPayload }
  | { kind: "sale"; payload: SalePayload }
  | { kind: "payment"; payload: PaymentPayload };

export type OutboxEntry = OutboxOp & {
  /** Auto-increment: operations are sent in the order they were made. */
  seq?: number;
  /** Id of the row the operation creates (client, invoice or payment). */
  ref_id: string;
  created_at: string;
  /** True when made while the phone was offline: the server then keeps the phone's time. */
  offline: boolean;
  state: LocalState;
  /** Feedback code of the last refusal, for an operation the server refused. */
  error?: string;
  attempts: number;
};

export type MetaEntry = { key: string; value: unknown };

export class ShopDatabase extends Dexie {
  products!: EntityTable<LocalProduct, "id">;
  clients!: EntityTable<LocalClient, "id">;
  invoices!: EntityTable<LocalInvoice, "id">;
  invoice_items!: EntityTable<LocalInvoiceItem, "id">;
  payments!: EntityTable<LocalPayment, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      products: "id, name",
      clients: "id, name",
      invoices: "id, created_at, client_id, status",
      invoice_items: "id, invoice_id",
      payments: "id, invoice_id",
      outbox: "++seq, ref_id, state",
      meta: "key",
    });
  }
}

/** One database per shop, so two shops used on the same phone never mix. */
export function shopDatabaseName(shopId: string) {
  return `wishop-${shopId}`;
}

let current: { shopId: string; db: ShopDatabase } | null = null;

export function openShopDatabase(shopId: string): ShopDatabase {
  if (current?.shopId === shopId) return current.db;
  current?.db.close();
  current = { shopId, db: new ShopDatabase(shopDatabaseName(shopId)) };
  return current.db;
}

export async function deleteShopDatabase(shopId: string) {
  if (current?.shopId === shopId) {
    current.db.close();
    current = null;
  }
  await Dexie.delete(shopDatabaseName(shopId));
}

export async function getMeta<T>(db: ShopDatabase, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: ShopDatabase, key: string, value: unknown) {
  await db.meta.put({ key, value });
}

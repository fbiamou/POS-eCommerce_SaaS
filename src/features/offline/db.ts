import Dexie, { type EntityTable } from "dexie";

// Local copy of the shop kept in the device, phone or computer (IndexedDB), so the app keeps
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
  local_state?: LocalState;
};

export type LocalSupplier = { id: string; name: string; is_active: boolean };

/** A team member, for choosing who sells on a shared device (till code). */
export type LocalMember = {
  id: string;
  full_name: string | null;
  role: "MANAGER" | "SELLER";
  is_active: boolean;
  /** Pages the owner opened to a seller (empty: every page but the settings). */
  allowed_pages: string[];
  /** Whether this person has a till code at all. */
  has_pin: boolean;
  /**
   * The code's print, only for the account itself and the sellers (to hand
   * the till over without internet). A manager's code is checked by the
   * server only (migration till_code_privacy).
   */
  pin_salt: string | null;
  pin_hash: string | null;
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
  /** Team member who recorded the sale, printed on the ticket. */
  seller_name: string | null;
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
  /** Time of the sale on the device; sent only when it was made offline. */
  sold_at: string;
  /** Who sold: the sale keeps their name even if a colleague sends it later. */
  seller_id: string | null;
};

export type PaymentPayload = {
  payment_id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  /** Who took the payment (same rule as a sale's seller). */
  recorded_by: string | null;
};

export type ClientPayload = {
  client_id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

/** What the item forms fill in (same fields online and offline). */
export type ProductFields = {
  name: string;
  category: string | null;
  brand: string | null;
  product_type: string | null;
  supplier_id: string | null;
  origin_country: string | null;
  purchase_price: number;
  selling_price: number;
  description: string | null;
  is_published_online: boolean;
};

export type ProductCreatePayload = ProductFields & { product_id: string; opening_stock: number; created_at: string };

export type ProductUpdatePayload = ProductFields & {
  product_id: string;
  /** Id of the change on the device: the stock movement's id on the server. */
  change_id: string;
  /** Counted quantity minus the device's quantity: other tills' sales stay counted. */
  stock_delta: number;
  changed_at: string;
  /** The item before the change, to put back if the server refuses it. */
  before: LocalProduct;
};

/** A delivery checked off offline (purchase order received). */
export type PurchaseOrderReceivePayload = {
  order_id: string;
  reference: string;
  entries: { item_id: string; received_quantity: number }[];
  /** Units entering each item's stock, to update the device's copy. */
  stock: { product_id: string; quantity: number }[];
  received_at: string;
};

/** Meta key marking a purchase order received on the device, not sent yet. */
export function purchaseOrderMarker(orderId: string) {
  return `po_received:${orderId}`;
}

export type OutboxOp =
  | { kind: "client"; payload: ClientPayload }
  | { kind: "sale"; payload: SalePayload }
  | { kind: "payment"; payload: PaymentPayload }
  | { kind: "product_create"; payload: ProductCreatePayload }
  | { kind: "product_update"; payload: ProductUpdatePayload }
  | { kind: "po_receive"; payload: PurchaseOrderReceivePayload };

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
  members!: EntityTable<LocalMember, "id">;
  suppliers!: EntityTable<LocalSupplier, "id">;

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
    // Till codes: the team, to check a code without internet.
    this.version(2).stores({ members: "id" });
    // Items created or changed offline: the shop's suppliers for the form.
    this.version(3).stores({ suppliers: "id" });
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

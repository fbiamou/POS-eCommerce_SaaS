import type { FeedbackCode } from "@/lib/feedback";
import { loyaltyDiscount } from "@/features/clients/loyalty";
import {
  deleteShopDatabase,
  type LocalClient,
  type LocalProduct,
  type OutboxEntry,
  type ProductFields,
  type ShopDatabase,
  purchaseOrderMarker,
} from "./db";
import { releaseSeq, takeNextSeq } from "./device";
import { applyPayment, buildLocalClient, buildLocalPayment, buildLocalSale, paymentProblem, soldQuantities, type LocalSale, type SaleLine } from "./records";
import { clearOfflinePages } from "./serviceWorker";
import type { OfflineContextValue } from "./OfflineProvider";

// What the till and the invoice pages do. Each action first tries the online
// shop, so the answer is immediate and exact (stock, loyalty card) as before.
// Without a network, or when the server does not answer in time, the action
// is kept on the device and sent later: the sale is never lost.

export type ActionResult = { ok: true; id: string; offline: boolean } | { ok: false; code: FeedbackCode };

type TillClient =
  | { kind: "none" }
  | { kind: "existing"; id: string; name: string; phone: string | null }
  | { kind: "new"; name: string; phone: string | null };

function newId() {
  return crypto.randomUUID();
}

function tryOnline(ctx: OfflineContextValue) {
  return ctx.status.online && navigator.onLine;
}

async function saveSale(db: ShopDatabase, sale: LocalSale, options: { offline: boolean; newClient: LocalClient | null }) {
  const { offline, newClient } = options;
  await db.transaction("rw", [db.clients, db.invoices, db.invoice_items, db.payments, db.products, db.outbox], async () => {
    if (newClient) await db.clients.put({ ...newClient, local_state: offline ? "pending" : undefined });
    await db.invoices.put({ ...sale.invoice, recorded_offline: offline, local_state: offline ? "pending" : undefined });
    await db.invoice_items.bulkPut(sale.items);
    if (sale.payment) await db.payments.put(sale.payment);
    for (const [productId, quantity] of soldQuantities(sale.items)) {
      const product = await db.products.get(productId);
      if (product) await db.products.update(productId, { quantity_in_stock: product.quantity_in_stock - quantity });
    }
    if (!offline) return;
    const base = { created_at: sale.invoice.created_at, offline: true, state: "pending" as const, attempts: 0 };
    if (newClient) {
      await db.outbox.add({
        ...base,
        kind: "client",
        ref_id: newClient.id,
        payload: { client_id: newClient.id, name: newClient.name, phone: newClient.phone, created_at: newClient.created_at },
      });
    }
    await db.outbox.add({ ...base, kind: "sale", ref_id: sale.invoice.id, payload: sale.payload });
  });
}

export async function sellAtTill(
  ctx: OfflineContextValue,
  input: {
    lines: SaleLine[];
    client: TillClient;
    paidAmount: number;
    /** Loyalty reward chosen at the till (percent of the lines' total). */
    loyalty: { use: boolean; percent: number };
    sellerName: string | null;
  }
): Promise<ActionResult> {
  const taken = await takeNextSeq(window.localStorage, ctx.shopId);
  if (!taken) return { ok: false, code: "device_not_ready" };

  const now = new Date();
  const built =
    input.client.kind === "new"
      ? buildLocalClient({ clientId: newId(), name: input.client.name, phone: input.client.phone, createdAt: now })
      : null;
  const client =
    input.client.kind === "existing"
      ? { id: input.client.id, name: input.client.name, phone: input.client.phone }
      : built
        ? { id: built.client.id, name: built.client.name, phone: built.client.phone }
        : null;
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const useReward = input.loyalty.use && client !== null;
  const sale = buildLocalSale({
    invoiceId: newId(),
    itemIds: input.lines.map(() => newId()),
    paymentId: newId(),
    device: taken.device,
    seq: taken.seq,
    soldAt: now,
    client,
    sellerId: ctx.cashier.id,
    sellerName: input.sellerName,
    lines: input.lines,
    paidAmount: input.paidAmount,
    discount: useReward ? loyaltyDiscount(subtotal, input.loyalty.percent) : 0,
    useLoyaltyReward: useReward,
  });

  const refuse = async (code: FeedbackCode): Promise<ActionResult> => {
    await releaseSeq(window.localStorage, ctx.shopId, taken.seq);
    return { ok: false, code };
  };

  if (tryOnline(ctx)) {
    let reachable = true;
    if (built) {
      const created = await ctx.tillBackend.recordClient(built.payload, false);
      if (!created.ok && !created.network) return refuse(created.code);
      reachable = created.ok;
    }
    if (reachable) {
      const recorded = await ctx.tillBackend.recordSale(sale.payload, false);
      if (recorded.ok) {
        await saveSale(ctx.db, sale, { offline: false, newClient: built?.client ?? null });
        ctx.requestSync();
        return { ok: true, id: sale.invoice.id, offline: false };
      }
      if (!recorded.network) return refuse(recorded.code);
    }
    ctx.markOffline();
  }

  // Kept on the device with the phone's time; the server keeps that time and
  // accepts the sale even if the stock went below zero meanwhile.
  await saveSale(ctx.db, sale, { offline: true, newClient: built?.client ?? null });
  ctx.requestSync();
  return { ok: true, id: sale.invoice.id, offline: true };
}

export async function payDebt(ctx: OfflineContextValue, invoiceId: string, amount: number): Promise<ActionResult> {
  const { db } = ctx;
  const invoice = await db.invoices.get(invoiceId);
  const built = buildLocalPayment({ paymentId: newId(), invoiceId, amount, paidAt: new Date(), recordedBy: ctx.cashier.id });

  if (invoice) {
    const problem = paymentProblem(invoice, amount);
    if (problem) return { ok: false, code: problem };
  }

  if (tryOnline(ctx)) {
    const recorded = await ctx.tillBackend.recordPayment(built.payload, false);
    if (recorded.ok) {
      if (invoice) {
        await db.transaction("rw", [db.invoices, db.payments], async () => {
          await db.payments.put(built.payment);
          await db.invoices.put(applyPayment(invoice, amount));
        });
      }
      ctx.requestSync();
      return { ok: true, id: built.payment.id, offline: false };
    }
    if (!recorded.network) return { ok: false, code: recorded.code };
    ctx.markOffline();
  }

  // An invoice the device does not have yet cannot be checked offline.
  if (!invoice) return { ok: false, code: "needs_connection" };

  await db.transaction("rw", [db.invoices, db.payments, db.outbox], async () => {
    await db.payments.put({ ...built.payment, local_state: "pending" });
    await db.invoices.put(applyPayment(invoice, amount));
    await db.outbox.add({
      kind: "payment",
      ref_id: built.payment.id,
      payload: built.payload,
      created_at: built.payment.payment_date,
      offline: true,
      state: "pending",
      attempts: 0,
    });
  });
  ctx.requestSync();
  return { ok: true, id: built.payment.id, offline: true };
}

/** A customer added from the customers page, online or kept on the device. */
export async function addClientAnywhere(ctx: OfflineContextValue, name: string, phone: string | null): Promise<ActionResult> {
  const built = buildLocalClient({ clientId: newId(), name, phone, createdAt: new Date() });
  if (!built.client.name) return { ok: false, code: "name_required" };

  if (tryOnline(ctx)) {
    const recorded = await ctx.tillBackend.recordClient(built.payload, false);
    if (recorded.ok) {
      await ctx.db.clients.put(built.client);
      ctx.requestSync();
      return { ok: true, id: built.client.id, offline: false };
    }
    if (!recorded.network) return { ok: false, code: recorded.code };
    ctx.markOffline();
  }

  const { db } = ctx;
  await db.transaction("rw", [db.clients, db.outbox], async () => {
    await db.clients.put({ ...built.client, local_state: "pending" });
    await db.outbox.add({
      kind: "client",
      ref_id: built.client.id,
      payload: built.payload,
      created_at: built.client.created_at,
      offline: true,
      state: "pending",
      attempts: 0,
    });
  });
  ctx.requestSync();
  return { ok: true, id: built.client.id, offline: true };
}

/** Sends a refused operation again, after the owner fixed the cause. */
export async function retryFailed(db: ShopDatabase, entry: OutboxEntry) {
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.payments, db.products, db.meta], async () => {
    if (entry.seq === undefined) return;
    await db.outbox.update(entry.seq, { state: "pending", error: undefined });
    if (entry.kind === "client") {
      await db.clients.update(entry.ref_id, { local_state: "pending" });
    } else if (entry.kind === "po_receive") {
      await addStock(db, entry.payload.stock);
      await db.meta.put({ key: purchaseOrderMarker(entry.payload.order_id), value: entry.payload.received_at });
    } else if (entry.kind === "product_create") {
      await db.products.update(entry.ref_id, { local_state: "pending" });
    } else if (entry.kind === "product_update") {
      // The refusal put the item back: the change applies again.
      const current = await db.products.get(entry.ref_id);
      if (current) await db.products.put(applyProductChange(current, entry.payload, entry.payload.stock_delta));
    } else if (entry.kind === "sale") {
      // The refusal gave the stock back: the sale takes it again.
      await db.invoices.update(entry.ref_id, { local_state: "pending" });
      for (const [productId, quantity] of soldQuantities(entry.payload.items)) {
        const product = await db.products.get(productId);
        if (product) await db.products.update(productId, { quantity_in_stock: product.quantity_in_stock - quantity });
      }
    } else if (entry.kind === "payment") {
      await db.payments.update(entry.ref_id, { local_state: "pending" });
      const invoice = await db.invoices.get(entry.payload.invoice_id);
      if (invoice) await db.invoices.put(applyPayment(invoice, entry.payload.amount));
    }
  });
}

/** Removes a refused operation and what it had created on the device. */
export async function dismissFailed(db: ShopDatabase, entry: OutboxEntry) {
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.invoice_items, db.payments, db.products], async () => {
    if (entry.seq !== undefined) await db.outbox.delete(entry.seq);
    if (entry.kind === "client") {
      await db.clients.delete(entry.ref_id);
    } else if (entry.kind === "product_create") {
      await db.products.delete(entry.ref_id);
    } else if (entry.kind === "product_update") {
      // Already put back when refused: only the mark goes.
      await db.products.update(entry.ref_id, { local_state: undefined });
    } else if (entry.kind === "sale") {
      await db.invoice_items.where("invoice_id").equals(entry.ref_id).delete();
      await db.payments.where("invoice_id").equals(entry.ref_id).delete();
      await db.invoices.delete(entry.ref_id);
    } else if (entry.kind === "payment") {
      await db.payments.delete(entry.ref_id);
    }
  });
}

// ---------- Items ----------

const text = (value: FormDataEntryValue | null) => (typeof value === "string" && value.trim()) || null;
const whole = (value: FormDataEntryValue | null) => {
  const parsed = parseInt(typeof value === "string" ? value : "", 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
};

/** The item forms' fields; the price field is "price" when adding, "selling_price" when editing. */
export function productFieldsFromForm(form: FormData, priceField: "price" | "selling_price"): ProductFields {
  return {
    name: text(form.get("name")) ?? "",
    category: text(form.get("category")),
    brand: text(form.get("brand")),
    product_type: text(form.get("type")),
    supplier_id: text(form.get("supplier_id")),
    origin_country: text(form.get("origin_country")),
    purchase_price: whole(form.get("purchase_price")),
    selling_price: whole(form.get(priceField)),
    description: text(form.get("description")),
    is_published_online: form.get("is_published_online") === "true",
  };
}

function applyProductChange(product: LocalProduct, fields: ProductFields, stockDelta: number): LocalProduct {
  return {
    ...product,
    name: fields.name,
    category_name: fields.category,
    brand: fields.brand,
    product_type: fields.product_type,
    supplier_id: fields.supplier_id,
    origin_country: fields.origin_country,
    purchase_price: fields.purchase_price,
    selling_price: fields.selling_price,
    description: fields.description,
    is_published_online: fields.is_published_online,
    quantity_in_stock: product.quantity_in_stock + stockDelta,
    local_state: "pending",
  };
}

/** An item added without internet: on the device at once, sent later. */
export async function createProductOffline(ctx: OfflineContextValue, fields: ProductFields, openingStock: number): Promise<ActionResult> {
  if (!fields.name) return { ok: false, code: "required_fields_missing" };
  const id = newId();
  const createdAt = new Date().toISOString();
  const { db } = ctx;
  await db.transaction("rw", [db.products, db.outbox], async () => {
    await db.products.put({
      id,
      name: fields.name,
      brand: fields.brand,
      product_type: fields.product_type,
      category_name: fields.category,
      supplier_id: fields.supplier_id,
      origin_country: fields.origin_country,
      quantity_in_stock: Math.max(0, openingStock),
      purchase_price: fields.purchase_price,
      selling_price: fields.selling_price,
      description: fields.description,
      image_url: null,
      is_published_online: fields.is_published_online,
      is_active: true,
      local_state: "pending",
    });
    await db.outbox.add({
      kind: "product_create",
      ref_id: id,
      payload: { ...fields, product_id: id, opening_stock: Math.max(0, openingStock), created_at: createdAt },
      created_at: createdAt,
      offline: true,
      state: "pending",
      attempts: 0,
    });
  });
  ctx.markOffline();
  ctx.requestSync();
  return { ok: true, id, offline: true };
}

/**
 * An item changed without internet. The counted quantity becomes a
 * difference with the device's stock, so the other tills' sales made
 * meanwhile are not erased when it reaches the server.
 */
export async function updateProductOffline(
  ctx: OfflineContextValue,
  productId: string,
  fields: ProductFields,
  countedQuantity: number
): Promise<ActionResult> {
  if (!fields.name) return { ok: false, code: "required_fields_missing" };
  const { db } = ctx;
  const before = await db.products.get(productId);
  if (!before) return { ok: false, code: "product_not_found" };
  const delta = countedQuantity - before.quantity_in_stock;
  const changeId = newId();
  const changedAt = new Date().toISOString();
  await db.transaction("rw", [db.products, db.outbox], async () => {
    await db.products.put(applyProductChange(before, fields, delta));
    await db.outbox.add({
      kind: "product_update",
      ref_id: productId,
      payload: { ...fields, product_id: productId, change_id: changeId, stock_delta: delta, changed_at: changedAt, before: { ...before, local_state: undefined } },
      created_at: changedAt,
      offline: true,
      state: "pending",
      attempts: 0,
    });
  });
  ctx.markOffline();
  ctx.requestSync();
  return { ok: true, id: productId, offline: true };
}

// ---------- Purchase orders ----------

async function addStock(db: ShopDatabase, lines: { product_id: string; quantity: number }[]) {
  for (const line of lines) {
    const product = await db.products.get(line.product_id);
    if (product) await db.products.update(line.product_id, { quantity_in_stock: product.quantity_in_stock + line.quantity });
  }
}

/**
 * A delivery checked off without internet: the units enter the device's
 * stock at once, and the reception reaches the server later (it is applied
 * there once only, at the time it was checked off).
 */
export async function receivePurchaseOrderOffline(
  ctx: OfflineContextValue,
  order: { id: string; reference: string; lines: { id: string; product_id: string }[] },
  entries: { item_id: string; received_quantity: number }[]
): Promise<ActionResult> {
  const productOf = new Map(order.lines.map((line) => [line.id, line.product_id]));
  const stock = entries
    .filter((entry) => entry.received_quantity > 0 && productOf.has(entry.item_id))
    .map((entry) => ({ product_id: productOf.get(entry.item_id)!, quantity: entry.received_quantity }));
  const receivedAt = new Date().toISOString();
  const { db } = ctx;
  await db.transaction("rw", [db.products, db.outbox, db.meta], async () => {
    await addStock(db, stock);
    await db.meta.put({ key: purchaseOrderMarker(order.id), value: receivedAt });
    await db.outbox.add({
      kind: "po_receive",
      ref_id: order.id,
      payload: { order_id: order.id, reference: order.reference, entries, stock, received_at: receivedAt },
      created_at: receivedAt,
      offline: true,
      state: "pending",
      attempts: 0,
    });
  });
  ctx.markOffline();
  ctx.requestSync();
  return { ok: true, id: order.id, offline: true };
}

/** Operations made offline and not sent yet: logging out would lose them. */
export async function unsentCount(db: ShopDatabase): Promise<number> {
  return db.outbox.where("state").equals("pending").count();
}

/**
 * On logout, once everything is sent: the shop's data leaves the device
 * (a shared phone, a shop computer). The till number stays with the device.
 */
export async function wipeDevice(shopId: string) {
  await deleteShopDatabase(shopId);
  await clearOfflinePages();
}

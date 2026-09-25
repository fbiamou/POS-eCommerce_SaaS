import type { FeedbackCode } from "@/lib/feedback";
import { loyaltyDiscount } from "@/features/clients/loyalty";
import { deleteShopDatabase, type LocalClient, type OutboxEntry, type ShopDatabase } from "./db";
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
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.payments, db.products], async () => {
    if (entry.seq === undefined) return;
    await db.outbox.update(entry.seq, { state: "pending", error: undefined });
    if (entry.kind === "client") {
      await db.clients.update(entry.ref_id, { local_state: "pending" });
    } else if (entry.kind === "sale") {
      // The refusal gave the stock back: the sale takes it again.
      await db.invoices.update(entry.ref_id, { local_state: "pending" });
      for (const [productId, quantity] of soldQuantities(entry.payload.items)) {
        const product = await db.products.get(productId);
        if (product) await db.products.update(productId, { quantity_in_stock: product.quantity_in_stock - quantity });
      }
    } else {
      await db.payments.update(entry.ref_id, { local_state: "pending" });
      const invoice = await db.invoices.get(entry.payload.invoice_id);
      if (invoice) await db.invoices.put(applyPayment(invoice, entry.payload.amount));
    }
  });
}

/** Removes a refused operation and what it had created on the device. */
export async function dismissFailed(db: ShopDatabase, entry: OutboxEntry) {
  await db.transaction("rw", [db.outbox, db.clients, db.invoices, db.invoice_items, db.payments], async () => {
    if (entry.seq !== undefined) await db.outbox.delete(entry.seq);
    if (entry.kind === "client") {
      await db.clients.delete(entry.ref_id);
    } else if (entry.kind === "sale") {
      await db.invoice_items.where("invoice_id").equals(entry.ref_id).delete();
      await db.payments.where("invoice_id").equals(entry.ref_id).delete();
      await db.invoices.delete(entry.ref_id);
    } else {
      await db.payments.delete(entry.ref_id);
    }
  });
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

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ShopDatabase, type LocalProduct, type OutboxEntry } from "./db";
import { buildLocalClient, buildLocalPayment, buildLocalSale } from "./records";
import { pullChanges, pushOutbox, syncNow, type Outcome, type ServerInvoice, type SyncBackend } from "./sync";

const OK: Outcome<null> = { ok: true, data: null };
const NETWORK: Outcome<null> = { ok: false, network: true, code: "generic_error" };

const perruque: LocalProduct = {
  id: "p-perruque", name: "Perruque lisse", brand: null, product_type: null, category_name: "Perruques",
  supplier_id: null, origin_country: null, quantity_in_stock: 10, purchase_price: 30000, selling_price: 45000,
  description: null, image_url: null, is_published_online: false, is_active: true,
};

type Call = { kind: string; offline: boolean; id: string };

function fakeBackend(overrides: Partial<SyncBackend> = {}) {
  const calls: Call[] = [];
  const since: Record<string, (string | null)[]> = { products: [], clients: [], invoices: [] };
  const backend: SyncBackend = {
    recordClient: async (p, offline) => (calls.push({ kind: "client", offline, id: p.client_id }), OK),
    recordSale: async (p, offline) => (calls.push({ kind: "sale", offline, id: p.invoice_id }), OK),
    recordPayment: async (p, offline) => (calls.push({ kind: "payment", offline, id: p.payment_id }), OK),
    pullProducts: async (s) => (since.products.push(s), { ok: true, data: [] }),
    pullClients: async (s) => (since.clients.push(s), { ok: true, data: [] }),
    pullInvoices: async (s) => (since.invoices.push(s), { ok: true, data: [] }),
    pullShop: async () => ({ ok: true, data: null }),
    pullMembers: async () => ({ ok: true, data: [] }),
    pullSuppliers: async () => ({ ok: true, data: [] }),
    recordProduct: async (p, offline) => (calls.push({ kind: "product_create", offline, id: p.product_id }), OK),
    updateProductOffline: async (p) => (calls.push({ kind: "product_update", offline: true, id: p.change_id }), OK),
    receivePurchaseOrderOffline: async (p) => (calls.push({ kind: "po_receive", offline: true, id: p.order_id }), OK),
    ...overrides,
  };
  return { backend, calls, since };
}

let db: ShopDatabase;
let counter = 0;

beforeEach(async () => {
  db = new ShopDatabase(`test-${++counter}`);
  await db.products.put(perruque);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

// What the till does for an offline sale: rows on the phone, stock taken
// off, and the operation queued.
async function queueOfflineSale(quantity: number, paid: number, clientId: string | null = null) {
  const sale = buildLocalSale({
    invoiceId: `inv-${quantity}-${paid}`, itemIds: [`it-${quantity}-${paid}`], paymentId: `pay-${quantity}-${paid}`,
    device: { id: "dev-1", number: 1, nextSeq: 1 }, seq: 1, soldAt: new Date("2026-09-26T09:00:00Z"),
    client: clientId ? { id: clientId, name: "Awa", phone: null } : null,
    lines: [{ product_id: perruque.id, product_name: perruque.name, quantity, unit_price: 45000 }],
    paidAmount: paid,
  });
  await db.invoices.put({ ...sale.invoice, recorded_offline: true, local_state: "pending" });
  await db.invoice_items.bulkPut(sale.items);
  if (sale.payment) await db.payments.put(sale.payment);
  const product = (await db.products.get(perruque.id))!;
  await db.products.update(perruque.id, { quantity_in_stock: product.quantity_in_stock - quantity });
  const entry: OutboxEntry = { kind: "sale", payload: sale.payload, ref_id: sale.invoice.id, created_at: sale.invoice.created_at, offline: true, state: "pending", attempts: 0 };
  await db.outbox.add(entry);
  return sale;
}

describe("sending what was done offline", () => {
  it("keeps everything waiting while there is no connection", async () => {
    await queueOfflineSale(2, 90000);
    const { backend } = fakeBackend({ recordSale: async () => NETWORK });
    const result = await syncNow(db, backend);
    expect(result).toEqual({ push: { sent: 0, failed: 0, offline: true }, pull: null });
    expect(await db.outbox.count()).toBe(1);
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(8);
  });

  it("sends in order and clears the marks once the server accepted", async () => {
    const { client, payload } = buildLocalClient({ clientId: "c-awa", name: "Awa", phone: null, createdAt: new Date() });
    await db.clients.put({ ...client, local_state: "pending" });
    await db.outbox.add({ kind: "client", payload, ref_id: "c-awa", created_at: client.created_at, offline: true, state: "pending", attempts: 0 });
    const sale = await queueOfflineSale(1, 0, "c-awa");

    const { backend, calls } = fakeBackend();
    const result = await pushOutbox(db, backend);

    expect(result).toEqual({ sent: 2, failed: 0, offline: false });
    expect(calls).toEqual([
      { kind: "client", offline: true, id: "c-awa" },
      { kind: "sale", offline: true, id: sale.invoice.id },
    ]);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.clients.get("c-awa"))?.local_state).toBeUndefined();
    expect((await db.invoices.get(sale.invoice.id))?.local_state).toBeUndefined();
  });

  it("keeps a refused sale « à vérifier » and gives its stock back", async () => {
    const sale = await queueOfflineSale(3, 135000);
    const { backend } = fakeBackend({ recordSale: async () => ({ ok: false, network: false, code: "product_not_found" }) });
    const result = await pushOutbox(db, backend);

    expect(result).toEqual({ sent: 0, failed: 1, offline: false });
    const [entry] = await db.outbox.toArray();
    expect(entry).toMatchObject({ state: "failed", error: "product_not_found", attempts: 1 });
    expect((await db.invoices.get(sale.invoice.id))?.local_state).toBe("failed");
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(10);
  });

  it("gives back a refused payment on a debt", async () => {
    const sale = await queueOfflineSale(1, 10000);
    await pushOutbox(db, fakeBackend().backend);
    const { payment, payload } = buildLocalPayment({ paymentId: "pay-late", invoiceId: sale.invoice.id, amount: 5000, paidAt: new Date() });
    await db.payments.put({ ...payment, local_state: "pending" });
    await db.invoices.update(sale.invoice.id, { paid_amount: 15000, status: "PARTIAL" });
    await db.outbox.add({ kind: "payment", payload, ref_id: "pay-late", created_at: payment.payment_date, offline: true, state: "pending", attempts: 0 });

    await pushOutbox(db, fakeBackend({ recordPayment: async () => ({ ok: false, network: false, code: "payment_exceeds_balance" }) }).backend);

    expect((await db.invoices.get(sale.invoice.id))?.paid_amount).toBe(10000);
    expect((await db.payments.get("pay-late"))?.local_state).toBe("failed");
  });
});

describe("receiving the server's changes", () => {
  const serverInvoice = (paid: number): ServerInvoice => ({
    id: "inv-server", invoice_number: "FAC-2026-2-0007", client_id: null, client_name: null, client_phone: null, seller_name: "Awa",
    total_amount: 20000, paid_amount: paid, discount_amount: 0, loyalty_reward_used: false,
    status: paid >= 20000 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID", created_at: "2026-09-26T08:00:00Z",
    recorded_offline: false, updated_at: "2026-09-26T08:05:00Z",
    items: [{ id: "it-s", invoice_id: "inv-server", product_id: perruque.id, product_name: perruque.name, quantity: 1, unit_price: 20000, total_price: 20000 }],
    payments: paid > 0 ? [{ id: "pay-s", invoice_id: "inv-server", amount: paid, payment_date: "2026-09-26T08:00:00Z" }] : [],
  });

  it("does not bring back stock already sold on the phone and not sent yet", async () => {
    await queueOfflineSale(2, 90000);
    const { backend } = fakeBackend({
      pullProducts: async () => ({ ok: true, data: [{ ...perruque, quantity_in_stock: 7, updated_at: "2026-09-26T09:10:00Z" }] }),
    });
    await pullChanges(db, backend);
    // Another phone sold 3 (10 → 7), this one sold 2 offline: 5 left.
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(5);
  });

  it("keeps a debt payment not sent yet on top of the server's invoice", async () => {
    const { payment, payload } = buildLocalPayment({ paymentId: "pay-local", invoiceId: "inv-server", amount: 5000, paidAt: new Date() });
    await db.payments.put({ ...payment, local_state: "pending" });
    await db.outbox.add({ kind: "payment", payload, ref_id: "pay-local", created_at: payment.payment_date, offline: true, state: "pending", attempts: 0 });

    await pullChanges(db, fakeBackend({ pullInvoices: async () => ({ ok: true, data: [serverInvoice(10000)] }) }).backend);

    expect(await db.invoices.get("inv-server")).toMatchObject({ paid_amount: 15000, status: "PARTIAL" });
    expect((await db.payments.where("invoice_id").equals("inv-server").toArray()).map((p) => p.id).sort()).toEqual(["pay-local", "pay-s"]);
  });

  it("keeps a sale made on the phone that the server does not know yet", async () => {
    const sale = await queueOfflineSale(1, 45000);
    await pullChanges(db, fakeBackend({ pullInvoices: async () => ({ ok: true, data: [serverInvoice(20000)] }) }).backend);
    expect((await db.invoices.get(sale.invoice.id))?.local_state).toBe("pending");
    expect(await db.invoices.count()).toBe(2);
  });

  it("asks only for what changed since the last time", async () => {
    const { backend, since } = fakeBackend({
      pullProducts: async (s) => (since.products.push(s), { ok: true, data: [{ ...perruque, updated_at: "2026-09-26T09:10:00Z" }] }),
      pullInvoices: async (s) => (since.invoices.push(s), { ok: true, data: [serverInvoice(0)] }),
    });
    await pullChanges(db, backend);
    await pullChanges(db, backend);
    await pullChanges(db, backend, { full: true });
    expect(since.products).toEqual([null, "2026-09-26T09:10:00Z", null]);
    // Invoices stay incremental, even on a full reload.
    expect(since.invoices).toEqual([null, "2026-09-26T08:05:00Z", "2026-09-26T08:05:00Z"]);
  });

  it("changes nothing when the connection drops during the pull", async () => {
    const { backend } = fakeBackend({
      pullProducts: async () => ({ ok: true, data: [{ ...perruque, quantity_in_stock: 1, updated_at: "2026-09-26T09:10:00Z" }] }),
      pullClients: async () => ({ ok: false, network: true, code: "generic_error" }),
    });
    expect(await pullChanges(db, backend)).toEqual({ ok: false, network: true });
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(10);
  });
});

describe("items changed offline", () => {
  const fields = {
    name: "Perruque lisse 50 cm", category: "Perruques", brand: null, product_type: null, supplier_id: null,
    origin_country: null, purchase_price: 30000, selling_price: 48000, description: null, is_published_online: false,
  };

  async function queueCount(counted: number) {
    const before = (await db.products.get(perruque.id))!;
    const delta = counted - before.quantity_in_stock;
    await db.products.put({ ...before, ...fields, category_name: "Perruques", quantity_in_stock: counted, local_state: "pending" });
    await db.outbox.add({
      kind: "product_update", ref_id: perruque.id, created_at: new Date().toISOString(), offline: true, state: "pending", attempts: 0,
      payload: { ...fields, product_id: perruque.id, change_id: "chg-1", stock_delta: delta, changed_at: new Date().toISOString(), before },
    });
  }

  it("does not bring the old count back when the server's copy arrives before the change is sent", async () => {
    await queueCount(14); // counted 14 on the shelf, the device had 10: +4
    const { backend } = fakeBackend({
      pullProducts: async () => ({ ok: true, data: [{ ...perruque, quantity_in_stock: 9, updated_at: "2026-09-26T09:10:00Z" }] }),
    });
    await pullChanges(db, backend);
    // Another till sold 1 (10 → 9); with this device's +4, 13 on the shelf.
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(13);
  });

  it("puts a refused change back, keeping the sales made on the device since", async () => {
    await queueCount(14);
    await queueOfflineSale(2, 90000); // 14 → 12, sale still waiting too
    const { backend } = fakeBackend({
      updateProductOffline: async () => ({ ok: false, network: false, code: "product_not_found" }),
      recordSale: async () => NETWORK,
    });
    await pushOutbox(db, backend);
    const product = await db.products.get(perruque.id);
    // Back to the old name and price, stock 10 − the 2 sold = 8.
    expect(product).toMatchObject({ name: "Perruque lisse", selling_price: 45000, quantity_in_stock: 8, local_state: "failed" });
  });
});

describe("a delivery checked off offline", () => {
  async function queueReception(quantity: number) {
    const product = (await db.products.get(perruque.id))!;
    await db.products.update(perruque.id, { quantity_in_stock: product.quantity_in_stock + quantity });
    await db.meta.put({ key: "po_received:po-1", value: "2026-09-26T09:00:00Z" });
    await db.outbox.add({
      kind: "po_receive", ref_id: "po-1", created_at: "2026-09-26T09:00:00Z", offline: true, state: "pending", attempts: 0,
      payload: { order_id: "po-1", reference: "BC-0003", entries: [{ item_id: "line-1", received_quantity: quantity }], stock: [{ product_id: perruque.id, quantity }], received_at: "2026-09-26T09:00:00Z" },
    });
  }

  it("keeps the delivered units when the server's copy arrives before the reception is sent", async () => {
    await queueReception(6); // 10 + 6 = 16 on the device
    const { backend } = fakeBackend({
      pullProducts: async () => ({ ok: true, data: [{ ...perruque, quantity_in_stock: 10, updated_at: "2026-09-26T09:10:00Z" }] }),
    });
    await pullChanges(db, backend);
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(16);
  });

  it("takes the units back out when the server refuses the reception", async () => {
    await queueReception(6);
    await pushOutbox(db, fakeBackend({ receivePurchaseOrderOffline: async () => ({ ok: false, network: false, code: "invalid_status_change" }) }).backend);
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(10);
    expect(await db.meta.get("po_received:po-1")).toBeUndefined();
  });

  it("clears the mark once the server has it", async () => {
    await queueReception(6);
    await pushOutbox(db, fakeBackend().backend);
    expect(await db.meta.get("po_received:po-1")).toBeUndefined();
    expect((await db.products.get(perruque.id))?.quantity_in_stock).toBe(16);
  });
});

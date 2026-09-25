import type {
  ClientPayload,
  InvoiceStatus,
  LocalClient,
  LocalInvoice,
  LocalInvoiceItem,
  LocalPayment,
  OutboxEntry,
  PaymentPayload,
  SalePayload,
} from "./db";
import { deviceInvoiceNumber, type DeviceState } from "./device";

// Builds, on the phone, the same rows the database functions create
// (record_sale, record_payment, record_client), so the screens show a sale
// or a payment at once, with or without internet. Amounts are whole francs
// (AGENTS.md), and every rule here mirrors the SQL one.

/** Same rule as record_sale and record_payment. */
export function invoiceStatus(paid: number, total: number): InvoiceStatus {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

export type SaleLine = { product_id: string; product_name: string; quantity: number; unit_price: number };

export type LocalSale = {
  invoice: LocalInvoice;
  items: LocalInvoiceItem[];
  payment: LocalPayment | null;
  payload: SalePayload;
};

export function buildLocalSale(input: {
  invoiceId: string;
  itemIds: string[];
  paymentId: string;
  device: DeviceState;
  seq: number;
  soldAt: Date;
  client: { id: string; name: string; phone: string | null } | null;
  lines: SaleLine[];
  paidAmount: number;
  /** Discount already checked by the server (loyalty reward); 0 offline. */
  discount?: number;
  useLoyaltyReward?: boolean;
}): LocalSale {
  const discount = input.discount ?? 0;
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const total = subtotal - discount;
  const paid = Math.min(Math.max(0, input.paidAmount), total);
  const createdAt = input.soldAt.toISOString();

  const invoice: LocalInvoice = {
    id: input.invoiceId,
    invoice_number: deviceInvoiceNumber(input.soldAt, input.device.number, input.seq),
    client_id: input.client?.id ?? null,
    client_name: input.client?.name ?? null,
    client_phone: input.client?.phone ?? null,
    total_amount: total,
    paid_amount: paid,
    discount_amount: discount,
    loyalty_reward_used: Boolean(input.useLoyaltyReward),
    status: invoiceStatus(paid, total),
    created_at: createdAt,
    recorded_offline: false,
  };

  const items: LocalInvoiceItem[] = input.lines.map((line, index) => ({
    id: input.itemIds[index],
    invoice_id: input.invoiceId,
    product_id: line.product_id,
    product_name: line.product_name,
    quantity: line.quantity,
    unit_price: line.unit_price,
    total_price: line.quantity * line.unit_price,
  }));

  const payment: LocalPayment | null =
    paid > 0 ? { id: input.paymentId, invoice_id: input.invoiceId, amount: paid, payment_date: createdAt } : null;

  const payload: SalePayload = {
    invoice_id: input.invoiceId,
    client_id: input.client?.id ?? null,
    items: input.lines.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
    paid_amount: paid,
    use_loyalty_reward: Boolean(input.useLoyaltyReward),
    device_id: input.device.id,
    device_seq: input.seq,
    sold_at: createdAt,
  };

  return { invoice, items, payment, payload };
}

/** The invoice after a payment on a debt, as record_payment leaves it. */
export function applyPayment(invoice: LocalInvoice, amount: number): LocalInvoice {
  const paid = invoice.paid_amount + amount;
  return { ...invoice, paid_amount: paid, status: invoiceStatus(paid, invoice.total_amount) };
}

/** Same checks as record_payment, to refuse at once what the server would refuse. */
export function paymentProblem(invoice: LocalInvoice, amount: number): "invalid_amount" | "invoice_already_paid" | "payment_exceeds_balance" | null {
  if (!Number.isInteger(amount) || amount <= 0) return "invalid_amount";
  if (invoice.paid_amount >= invoice.total_amount) return "invoice_already_paid";
  if (amount > invoice.total_amount - invoice.paid_amount) return "payment_exceeds_balance";
  return null;
}

export function buildLocalPayment(input: { paymentId: string; invoiceId: string; amount: number; paidAt: Date }): {
  payment: LocalPayment;
  payload: PaymentPayload;
} {
  const paidAt = input.paidAt.toISOString();
  return {
    payment: { id: input.paymentId, invoice_id: input.invoiceId, amount: input.amount, payment_date: paidAt },
    payload: { payment_id: input.paymentId, invoice_id: input.invoiceId, amount: input.amount, paid_at: paidAt },
  };
}

export function buildLocalClient(input: { clientId: string; name: string; phone: string | null; createdAt: Date }): {
  client: LocalClient;
  payload: ClientPayload;
} {
  const createdAt = input.createdAt.toISOString();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  return {
    client: { id: input.clientId, name, phone, is_active: true, created_at: createdAt },
    payload: { client_id: input.clientId, name, phone, created_at: createdAt },
  };
}

/** Quantity sold per product, to take it off the phone's copy of the stock. */
export function soldQuantities(items: { product_id: string; quantity: number }[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const item of items) sold.set(item.product_id, (sold.get(item.product_id) ?? 0) + item.quantity);
  return sold;
}

/** Operations still waiting to be sent, and those the server refused. */
export function outboxCounts(entries: Pick<OutboxEntry, "state">[]) {
  let pending = 0;
  let failed = 0;
  for (const entry of entries) {
    if (entry.state === "failed") failed++;
    else pending++;
  }
  return { pending, failed };
}

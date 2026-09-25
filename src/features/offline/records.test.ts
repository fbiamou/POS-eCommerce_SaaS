import { describe, expect, it } from "vitest";
import { applyPayment, buildLocalClient, buildLocalPayment, buildLocalSale, invoiceStatus, outboxCounts, paymentProblem, soldQuantities } from "./records";
import { deviceInvoiceNumber, deviceLabel, reconcileDevice, readDevice, releaseSeq, takeNextSeq, writeDevice } from "./device";

const device = { id: "dev-1", number: 1, nextSeq: 43 };
const lines = [
  { product_id: "p-perruque", product_name: "Perruque lisse", quantity: 1, unit_price: 45000 },
  { product_id: "p-creme", product_name: "Crème", quantity: 2, unit_price: 3500 },
];

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("invoice status", () => {
  it("follows record_sale: paid, partial or unpaid", () => {
    expect(invoiceStatus(52000, 52000)).toBe("PAID");
    expect(invoiceStatus(10000, 52000)).toBe("PARTIAL");
    expect(invoiceStatus(0, 52000)).toBe("UNPAID");
  });
});

describe("a sale made on the phone", () => {
  const base = {
    invoiceId: "inv-1",
    itemIds: ["it-1", "it-2"],
    paymentId: "pay-1",
    device,
    seq: 43,
    soldAt: new Date("2026-09-26T09:30:00Z"),
    client: { id: "c-awa", name: "Awa", phone: "+240555" },
    lines,
  };

  it("adds up the lines and numbers the invoice on the till's series", () => {
    const sale = buildLocalSale({ ...base, paidAmount: 52000 });
    expect(sale.invoice.total_amount).toBe(52000);
    expect(sale.invoice.invoice_number).toBe("FAC-2026-1-0043");
    expect(sale.invoice.status).toBe("PAID");
    expect(sale.items.map((i) => i.total_price)).toEqual([45000, 7000]);
    expect(sale.payment?.amount).toBe(52000);
    expect(sale.payload).toMatchObject({ device_id: "dev-1", device_seq: 43, paid_amount: 52000, client_id: "c-awa" });
  });

  it("records a credit sale: the part paid now, the rest owed", () => {
    const sale = buildLocalSale({ ...base, paidAmount: 20000 });
    expect(sale.invoice.status).toBe("PARTIAL");
    expect(sale.invoice.paid_amount).toBe(20000);
    expect(sale.payment?.amount).toBe(20000);
  });

  it("never records more paid than the total, and no payment when nothing is paid", () => {
    expect(buildLocalSale({ ...base, paidAmount: 60000 }).invoice.paid_amount).toBe(52000);
    const unpaid = buildLocalSale({ ...base, paidAmount: 0 });
    expect(unpaid.invoice.status).toBe("UNPAID");
    expect(unpaid.payment).toBeNull();
  });

  it("takes a loyalty discount off the total when the server granted it", () => {
    const sale = buildLocalSale({ ...base, paidAmount: 46800, discount: 5200, useLoyaltyReward: true });
    expect(sale.invoice.total_amount).toBe(46800);
    expect(sale.invoice.status).toBe("PAID");
    expect(sale.payload.use_loyalty_reward).toBe(true);
  });

  it("counts the quantities sold per item", () => {
    expect(soldQuantities([...lines, { product_id: "p-creme", quantity: 1 }])).toEqual(
      new Map([["p-perruque", 1], ["p-creme", 3]])
    );
  });
});

describe("a payment on a debt", () => {
  const invoice = buildLocalSale({
    invoiceId: "inv-2", itemIds: ["a", "b"], paymentId: "p", device, seq: 44,
    soldAt: new Date("2026-09-26T10:00:00Z"), client: null, lines, paidAmount: 12000,
  }).invoice;

  it("follows record_payment: partial, then paid", () => {
    expect(applyPayment(invoice, 10000)).toMatchObject({ paid_amount: 22000, status: "PARTIAL" });
    expect(applyPayment(invoice, 40000)).toMatchObject({ paid_amount: 52000, status: "PAID" });
  });

  it("refuses what the server would refuse", () => {
    expect(paymentProblem(invoice, 0)).toBe("invalid_amount");
    expect(paymentProblem(invoice, 40001)).toBe("payment_exceeds_balance");
    expect(paymentProblem({ ...invoice, paid_amount: 52000 }, 1)).toBe("invoice_already_paid");
    expect(paymentProblem(invoice, 40000)).toBeNull();
  });

  it("keeps the phone's time for the server", () => {
    const { payment, payload } = buildLocalPayment({ paymentId: "pay-9", invoiceId: "inv-2", amount: 5000, paidAt: new Date("2026-09-26T11:00:00Z") });
    expect(payment.payment_date).toBe("2026-09-26T11:00:00.000Z");
    expect(payload).toEqual({ payment_id: "pay-9", invoice_id: "inv-2", amount: 5000, paid_at: "2026-09-26T11:00:00.000Z" });
  });
});

describe("a customer created at the till", () => {
  it("trims the name and keeps an empty phone as none", () => {
    const { client, payload } = buildLocalClient({ clientId: "c-1", name: "  Nina ", phone: " ", createdAt: new Date("2026-09-26T08:00:00Z") });
    expect(client).toMatchObject({ name: "Nina", phone: null, is_active: true });
    expect(payload.name).toBe("Nina");
  });
});

describe("the till's number series", () => {
  it("uses the database format", () => {
    expect(deviceInvoiceNumber(new Date("2026-12-31T23:30:00Z"), 2, 15)).toBe("FAC-2026-2-0015");
    expect(deviceInvoiceNumber(new Date("2027-01-01T00:10:00Z"), 1, 12345)).toBe("FAC-2027-1-12345");
  });

  it("resumes after the highest number, known by the server or only by the phone", () => {
    // Sales 43 and 44 were made offline: the server only knows 42.
    expect(reconcileDevice({ id: "dev-1", number: 1, nextSeq: 45 }, { device_id: "dev-1", device_number: 1, last_seq: 42 }).nextSeq).toBe(45);
    // The phone was restored from an old state: the server knows more.
    expect(reconcileDevice({ id: "dev-1", number: 1, nextSeq: 10 }, { device_id: "dev-1", device_number: 1, last_seq: 42 }).nextSeq).toBe(43);
    // A new till starts at 1.
    expect(reconcileDevice(null, { device_id: "dev-2", device_number: 2, last_seq: 0 })).toEqual({ id: "dev-2", number: 2, nextSeq: 1 });
    // Another till id (phone wiped): the local series does not count.
    expect(reconcileDevice({ id: "old", number: 1, nextSeq: 99 }, { device_id: "dev-3", device_number: 3, last_seq: 0 }).nextSeq).toBe(1);
  });

  it("gives each sale the next number and can give back one refused at once", async () => {
    const storage = memoryStorage();
    expect(await takeNextSeq(storage, "shop")).toBeNull();
    writeDevice(storage, "shop", device);
    expect((await takeNextSeq(storage, "shop"))?.seq).toBe(43);
    expect((await takeNextSeq(storage, "shop"))?.seq).toBe(44);
    await releaseSeq(storage, "shop", 44);
    expect(readDevice(storage, "shop")?.nextSeq).toBe(44);
    // 43 cannot be given back: 44 was taken after it.
    await takeNextSeq(storage, "shop");
    await releaseSeq(storage, "shop", 43);
    expect(readDevice(storage, "shop")?.nextSeq).toBe(45);
  });

  it("names the phone briefly", () => {
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
  });
});

describe("the outbox counter", () => {
  it("separates operations waiting to be sent from those refused", () => {
    expect(outboxCounts([{ state: "pending" }, { state: "pending" }, { state: "failed" }])).toEqual({ pending: 2, failed: 1 });
  });
});

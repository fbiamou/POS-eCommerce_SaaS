// Turns a shop's raw rows into the CSV files of its full data export (pure,
// tested). Links between tables are resolved to what a person reads — a
// client's name, an invoice number — while each file keeps the identifiers
// needed to rebuild the links in another tool.

import { exportDate, toExportCsv, type CsvValue } from "./csv";
import type { ZipEntry } from "./zip";

type Id = string;

export type ExportData = {
  shop: {
    shop_name: string | null;
    shop_phone: string | null;
    shop_email: string | null;
    shop_address: string | null;
    country_code: string | null;
    tax_id: string | null;
    trade_register: string | null;
    shop_slug: string | null;
  } | null;
  categories: { id: Id; name: string }[];
  suppliers: { id: Id; name: string; phone: string | null; is_active: boolean; created_at: string }[];
  products: {
    id: Id;
    name: string;
    category_id: Id | null;
    product_type: string | null;
    brand: string | null;
    supplier: string | null;
    supplier_id: Id | null;
    origin_country: string | null;
    purchase_price: number | null;
    selling_price: number;
    quantity_in_stock: number;
    is_published_online: boolean;
    is_active: boolean;
    description: string | null;
    image_url: string | null;
    created_at: string;
  }[];
  clients: { id: Id; name: string; phone: string | null; is_active: boolean; created_at: string }[];
  profiles: { id: Id; full_name: string | null; role: string; is_active: boolean; created_at: string }[];
  invoices: {
    id: Id;
    invoice_number: string | null;
    client_id: Id | null;
    total_amount: number;
    discount_amount: number;
    paid_amount: number;
    status: string;
    loyalty_reward_used: boolean;
    created_by: Id | null;
    created_at: string;
  }[];
  invoiceItems: { invoice_id: Id; product_id: Id | null; quantity: number; unit_price: number; total_price: number }[];
  payments: { invoice_id: Id; amount: number; payment_date: string; recorded_by: Id | null }[];
  stockMovements: { product_id: Id | null; type: string; quantity_change: number; created_at: string; created_by: Id | null }[];
  purchaseOrders: {
    id: Id;
    reference: string | null;
    supplier_id: Id | null;
    status: string;
    created_at: string;
    sent_at: string | null;
    received_at: string | null;
  }[];
  purchaseOrderItems: {
    purchase_order_id: Id;
    product_id: Id | null;
    quantity: number;
    received_quantity: number | null;
    excluded: boolean;
  }[];
  shipments: {
    id: Id;
    reference: string | null;
    intermediary_name: string | null;
    intermediary_phone: string | null;
    purchase_order_id: Id | null;
    status: string;
    declared_at: string | null;
    received_at: string | null;
  }[];
  shipmentItems: {
    shipment_id: Id;
    name: string;
    category_name: string | null;
    product_type: string | null;
    brand: string | null;
    unit_purchase_price: number | null;
    declared_quantity: number;
    received_quantity: number | null;
  }[];
  onlineOrders: {
    id: Id;
    customer_name: string | null;
    customer_phone: string | null;
    status: string;
    total_amount: number;
    invoice_id: Id | null;
    created_at: string;
    confirmed_at: string | null;
  }[];
  onlineOrderItems: { order_id: Id; product_id: Id | null; quantity: number; unit_price: number; total_price: number }[];
  reminders: { client_id: Id | null; invoice_id: Id | null; template_name: string | null; status: string; sent_at: string }[];
};

// Every visible word goes through the translation files: file names and
// column headers ("Export.file_*", "Export.col_*"), yes/no, and every code
// stored in the database ("Export.invoice_status_PAID"...). The owner reads
// her data in her own language, never the English codes of the database.
export type ExportTranslate = (key: string) => string;

// The database enums (supabase/migrations), each translated in messages/*.json.
export const EXPORT_CODES = {
  invoice_status: ["PAID", "PARTIAL", "UNPAID"],
  movement_type: ["SALE", "RESTOCK", "ADJUSTMENT"],
  online_order_status: ["PENDING", "CONFIRMED", "CANCELLED"],
  purchase_order_status: ["DRAFT", "SENT", "RECEIVED", "CANCELLED"],
  reminder_status: ["SENT", "FAILED", "SIMULATED", "MANUAL"],
  role: ["MANAGER", "SELLER"],
  shipment_status: ["AWAITING_DECLARATION", "IN_TRANSIT", "RECEIVED", "CANCELLED"],
} as const;

type CodeKind = keyof typeof EXPORT_CODES;

// A country's name in the owner's language ("GQ" → "Guinea Ecuatorial").
function countryName(code: string | null, locale: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function byId<T extends { id: Id }>(rows: T[]): Map<Id, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function chronological<T>(rows: T[], date: (row: T) => string | null): T[] {
  return [...rows].sort((a, b) => (date(a) ?? "").localeCompare(date(b) ?? ""));
}

export function buildExportFiles(data: ExportData, t: ExportTranslate, timeZone: string, locale: string): ZipEntry[] {
  const yes = (value: boolean) => (value ? t("yes") : t("no"));
  const label = (kind: CodeKind, value: string | null) => {
    if (!value) return "";
    return (EXPORT_CODES[kind] as readonly string[]).includes(value) ? t(`${kind}_${value}`) : value;
  };
  const date = (value: string | null | undefined) => exportDate(value, timeZone);
  const categories = byId(data.categories);
  const suppliers = byId(data.suppliers);
  const products = byId(data.products);
  const clients = byId(data.clients);
  const people = byId(data.profiles);
  const invoices = byId(data.invoices);
  const purchaseOrders = byId(data.purchaseOrders);
  const shipments = byId(data.shipments);

  const productName = (id: Id | null) => (id ? products.get(id)?.name ?? "" : "");
  const personName = (id: Id | null) => (id ? people.get(id)?.full_name ?? "" : "");
  const invoiceNumber = (id: Id | null) => (id ? invoices.get(id)?.invoice_number ?? "" : "");

  const file = (key: string, columns: string[], rows: CsvValue[][]): ZipEntry => ({
    name: `${t(`file_${key}`)}.csv`,
    content: toExportCsv(columns.map((column) => t(`col_${column}`)), rows),
  });

  const shop = data.shop;
  return [
    file(
      "shop",
      ["shop_name", "phone", "email", "address", "country", "tax_id", "trade_register", "storefront_address"],
      shop
        ? [[shop.shop_name, shop.shop_phone, shop.shop_email, shop.shop_address, countryName(shop.country_code, locale), shop.tax_id, shop.trade_register, shop.shop_slug]]
        : [],
    ),
    file(
      "products",
      ["id", "name", "category", "type", "brand", "supplier", "origin_country", "purchase_price", "selling_price", "quantity_in_stock", "published_online", "active", "description", "image_url", "created_at"],
      [...data.products]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => [
          p.id,
          p.name,
          p.category_id ? categories.get(p.category_id)?.name ?? "" : "",
          p.product_type,
          p.brand,
          (p.supplier_id ? suppliers.get(p.supplier_id)?.name : null) ?? p.supplier,
          p.origin_country,
          p.purchase_price,
          p.selling_price,
          p.quantity_in_stock,
          yes(p.is_published_online),
          yes(p.is_active),
          p.description,
          p.image_url,
          date(p.created_at),
        ]),
    ),
    file("categories", ["id", "name"], data.categories.map((c) => [c.id, c.name])),
    file(
      "clients",
      ["id", "name", "phone", "active", "created_at"],
      chronological(data.clients, (c) => c.created_at).map((c) => [c.id, c.name, c.phone, yes(c.is_active), date(c.created_at)]),
    ),
    file(
      "suppliers",
      ["id", "name", "phone", "active", "created_at"],
      chronological(data.suppliers, (s) => s.created_at).map((s) => [s.id, s.name, s.phone, yes(s.is_active), date(s.created_at)]),
    ),
    file(
      "invoices",
      ["id", "invoice_number", "date", "client", "client_phone", "total", "loyalty_discount", "paid", "remaining", "status", "seller"],
      chronological(data.invoices, (i) => i.created_at).map((i) => {
        const client = i.client_id ? clients.get(i.client_id) : undefined;
        return [
          i.id,
          i.invoice_number,
          date(i.created_at),
          client?.name,
          client?.phone,
          i.total_amount,
          i.discount_amount,
          i.paid_amount,
          Math.max(i.total_amount - i.paid_amount, 0),
          label("invoice_status", i.status),
          personName(i.created_by),
        ];
      }),
    ),
    file(
      "invoice_items",
      ["invoice_number", "product", "quantity", "unit_price", "line_total"],
      data.invoiceItems.map((item) => [invoiceNumber(item.invoice_id), productName(item.product_id), item.quantity, item.unit_price, item.total_price]),
    ),
    file(
      "payments",
      ["invoice_number", "date", "amount", "recorded_by"],
      chronological(data.payments, (p) => p.payment_date).map((p) => [invoiceNumber(p.invoice_id), date(p.payment_date), p.amount, personName(p.recorded_by)]),
    ),
    file(
      "stock_movements",
      ["date", "product", "movement_type", "quantity_change", "by"],
      chronological(data.stockMovements, (m) => m.created_at).map((m) => [date(m.created_at), productName(m.product_id), label("movement_type", m.type), m.quantity_change, personName(m.created_by)]),
    ),
    file(
      "purchase_orders",
      ["id", "reference", "supplier", "status", "created_at", "sent_at", "received_at"],
      chronological(data.purchaseOrders, (o) => o.created_at).map((o) => [
        o.id,
        o.reference,
        o.supplier_id ? suppliers.get(o.supplier_id)?.name ?? "" : "",
        label("purchase_order_status", o.status),
        date(o.created_at),
        date(o.sent_at),
        date(o.received_at),
      ]),
    ),
    file(
      "purchase_order_items",
      ["reference", "product", "quantity", "received_quantity", "excluded"],
      data.purchaseOrderItems.map((item) => [
        purchaseOrders.get(item.purchase_order_id)?.reference ?? item.purchase_order_id,
        productName(item.product_id),
        item.quantity,
        item.received_quantity,
        yes(item.excluded),
      ]),
    ),
    file(
      "shipments",
      ["id", "reference", "intermediary", "intermediary_phone", "purchase_order", "status", "declared_at", "received_at"],
      chronological(data.shipments, (s) => s.declared_at).map((s) => [
        s.id,
        s.reference,
        s.intermediary_name,
        s.intermediary_phone,
        s.purchase_order_id ? purchaseOrders.get(s.purchase_order_id)?.reference ?? "" : "",
        label("shipment_status", s.status),
        date(s.declared_at),
        date(s.received_at),
      ]),
    ),
    file(
      "shipment_items",
      ["reference", "name", "category", "type", "brand", "purchase_price", "declared_quantity", "received_quantity"],
      data.shipmentItems.map((item) => [
        shipments.get(item.shipment_id)?.reference ?? item.shipment_id,
        item.name,
        item.category_name,
        item.product_type,
        item.brand,
        item.unit_purchase_price,
        item.declared_quantity,
        item.received_quantity,
      ]),
    ),
    file(
      "online_orders",
      ["id", "date", "customer", "customer_phone", "total", "status", "invoice_number", "confirmed_at"],
      chronological(data.onlineOrders, (o) => o.created_at).map((o) => [
        o.id,
        date(o.created_at),
        o.customer_name,
        o.customer_phone,
        o.total_amount,
        label("online_order_status", o.status),
        invoiceNumber(o.invoice_id),
        date(o.confirmed_at),
      ]),
    ),
    file(
      "online_order_items",
      ["order", "product", "quantity", "unit_price", "line_total"],
      data.onlineOrderItems.map((item) => [item.order_id, productName(item.product_id), item.quantity, item.unit_price, item.total_price]),
    ),
    file(
      "reminders",
      ["date", "client", "invoice_number", "template", "status"],
      chronological(data.reminders, (r) => r.sent_at).map((r) => [
        date(r.sent_at),
        r.client_id ? clients.get(r.client_id)?.name ?? "" : "",
        invoiceNumber(r.invoice_id),
        // Only a real Meta template name is shown: manual links and test runs
        // are logged with internal markers, and their status already says so.
        r.status === "SENT" || r.status === "FAILED" ? r.template_name : "",
        label("reminder_status", r.status),
      ]),
    ),
    file(
      "team",
      ["name", "role", "active", "created_at"],
      chronological(data.profiles, (p) => p.created_at).map((p) => [p.full_name, label("role", p.role), yes(p.is_active), date(p.created_at)]),
    ),
  ];
}

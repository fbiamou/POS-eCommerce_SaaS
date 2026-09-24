import "server-only";

import { createClient } from "@/utils/supabase/server";

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";

export type LowStockProduct = {
  id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  quantity_in_stock: number;
  supplier_name: string | null;
  in_open_order: boolean;
};

export async function getLowStockProducts(threshold: number): Promise<LowStockProduct[]> {
  const supabase = await createClient();
  const [{ data: products, error }, { data: openItems }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, product_type, quantity_in_stock, suppliers(name)")
      .eq("is_active", true)
      .lte("quantity_in_stock", threshold)
      .order("quantity_in_stock", { ascending: true }),
    supabase
      .from("purchase_order_items")
      .select("product_id, purchase_orders!inner(status)")
      .eq("excluded", false)
      .in("purchase_orders.status", ["DRAFT", "SENT"]),
  ]);

  if (error) {
    console.error("Error fetching low stock products:", error);
    return [];
  }

  const ordered = new Set((openItems ?? []).map((item) => item.product_id as string));
  return ((products ?? []) as unknown as (Omit<LowStockProduct, "supplier_name" | "in_open_order"> & {
    suppliers: { name: string } | null;
  })[]).map(({ suppliers, ...product }) => ({
    ...product,
    supplier_name: suppliers?.name ?? null,
    in_open_order: ordered.has(product.id),
  }));
}

export type PurchaseOrderSummary = {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  supplier_name: string | null;
  line_count: number;
  unit_count: number;
};

type OrderRow = Omit<PurchaseOrderSummary, "supplier_name" | "line_count" | "unit_count"> & {
  suppliers: { name: string } | null;
  purchase_order_items: { quantity: number; excluded: boolean }[];
};

export async function getPurchaseOrders(): Promise<PurchaseOrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, reference, status, created_at, sent_at, received_at, suppliers(name), purchase_order_items(quantity, excluded)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching purchase orders:", error);
    return [];
  }
  return ((data ?? []) as unknown as OrderRow[]).map(({ suppliers, purchase_order_items, ...order }) => {
    const lines = (purchase_order_items ?? []).filter((item) => !item.excluded);
    return {
      ...order,
      supplier_name: suppliers?.name ?? null,
      line_count: lines.length,
      unit_count: lines.reduce((sum, item) => sum + item.quantity, 0),
    };
  });
}

export type PurchaseOrderLine = {
  id: string;
  product_id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  quantity: number;
  stock_at_creation: number;
  current_stock: number;
  excluded: boolean;
  /** Checked off at reception; null until the order is received. */
  received_quantity: number | null;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  supplier_phone: string | null;
  lines: PurchaseOrderLine[];
  shipments: { id: string; reference: string; status: string }[];
};

type LineRow = {
  id: string;
  product_id: string;
  quantity: number;
  stock_at_creation: number;
  excluded: boolean;
  received_quantity: number | null;
  products: { name: string; brand: string | null; product_type: string | null; quantity_in_stock: number } | null;
};

export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const supabase = await createClient();
  const [{ data: order, error }, { data: lines }, { data: shipments }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, reference, status, created_at, sent_at, received_at, suppliers(name, phone), purchase_order_items(quantity, excluded)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("id, product_id, quantity, stock_at_creation, excluded, received_quantity, products(name, brand, product_type, quantity_in_stock)")
      .eq("purchase_order_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("shipments").select("id, reference, status").eq("purchase_order_id", id).order("created_at"),
  ]);

  if (error || !order) {
    if (error) console.error("Error fetching purchase order:", error);
    return null;
  }

  const row = order as unknown as OrderRow & { suppliers: { name: string; phone: string | null } | null };
  const activeLines = (row.purchase_order_items ?? []).filter((item) => !item.excluded);
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    created_at: row.created_at,
    sent_at: row.sent_at,
    received_at: row.received_at,
    supplier_name: row.suppliers?.name ?? null,
    supplier_phone: row.suppliers?.phone ?? null,
    line_count: activeLines.length,
    unit_count: activeLines.reduce((sum, item) => sum + item.quantity, 0),
    lines: ((lines ?? []) as unknown as LineRow[]).map((line) => ({
      id: line.id,
      product_id: line.product_id,
      name: line.products?.name ?? "—",
      brand: line.products?.brand ?? null,
      product_type: line.products?.product_type ?? null,
      quantity: line.quantity,
      stock_at_creation: line.stock_at_creation,
      current_stock: line.products?.quantity_in_stock ?? 0,
      excluded: line.excluded,
      received_quantity: line.received_quantity,
    })),
    shipments: shipments ?? [],
  };
}

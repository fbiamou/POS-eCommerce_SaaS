import "server-only";

import { createClient } from "@/utils/supabase/server";
import { productKey } from "./matching";

export type ShipmentStatus = "AWAITING_DECLARATION" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

export type ShipmentSummary = {
  id: string;
  reference: string;
  intermediary_name: string | null;
  intermediary_phone: string | null;
  status: ShipmentStatus;
  intake_token: string;
  created_at: string;
  declared_at: string | null;
  received_at: string | null;
  purchase_order_reference: string | null;
  item_count: number;
  declared_units: number;
  received_units: number | null;
};

type ShipmentRow = Omit<ShipmentSummary, "purchase_order_reference" | "item_count" | "declared_units" | "received_units"> & {
  purchase_orders: { reference: string } | null;
  shipment_items: { declared_quantity: number; received_quantity: number | null }[];
};

const SHIPMENT_COLUMNS =
  "id, reference, intermediary_name, intermediary_phone, status, intake_token, created_at, declared_at, received_at, purchase_orders(reference), shipment_items(declared_quantity, received_quantity)";

function toSummary(row: ShipmentRow): ShipmentSummary {
  const { purchase_orders, shipment_items, ...rest } = row;
  const items = shipment_items ?? [];
  const received = items.every((i) => i.received_quantity !== null) && items.length > 0;
  return {
    ...rest,
    purchase_order_reference: purchase_orders?.reference ?? null,
    item_count: items.length,
    declared_units: items.reduce((sum, i) => sum + i.declared_quantity, 0),
    received_units: received ? items.reduce((sum, i) => sum + (i.received_quantity ?? 0), 0) : null,
  };
}

export async function getShipments(): Promise<ShipmentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shipments").select(SHIPMENT_COLUMNS).order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching shipments:", error);
    return [];
  }
  return ((data ?? []) as unknown as ShipmentRow[]).map(toSummary);
}

export type ShipmentItem = {
  id: string;
  name: string;
  category_name: string | null;
  product_type: string | null;
  brand: string | null;
  unit_purchase_price: number;
  declared_quantity: number;
  received_quantity: number | null;
  // An active product of the shop with the same name, brand and type: the
  // received units will be added to it. Otherwise a new product is created.
  existing_product: { id: string; selling_price: number; quantity_in_stock: number } | null;
};

export type ShipmentDetail = ShipmentSummary & {
  photo_url: string | null;
  items: ShipmentItem[];
};

export async function getShipmentDetail(id: string): Promise<ShipmentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(`${SHIPMENT_COLUMNS}, photo_path`)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Error fetching shipment:", error);
    return null;
  }

  const row = data as unknown as ShipmentRow & { photo_path: string | null };
  const [{ data: items }, { data: products }, photo] = await Promise.all([
    supabase
      .from("shipment_items")
      .select("id, name, category_name, product_type, brand, unit_purchase_price, declared_quantity, received_quantity")
      .eq("shipment_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("id, name, brand, product_type, selling_price, quantity_in_stock").eq("is_active", true),
    // The parcel photo lives in a private bucket: a short-lived signed link.
    row.photo_path
      ? supabase.storage.from("shipment-photos").createSignedUrl(row.photo_path, 60 * 60)
      : Promise.resolve({ data: null }),
  ]);

  const productsByKey = new Map(
    (products ?? []).map((p) => [productKey(p.name, p.brand, p.product_type), p] as const)
  );

  return {
    ...toSummary(row),
    photo_url: photo.data?.signedUrl ?? null,
    items: (items ?? []).map((item) => {
      const match = productsByKey.get(productKey(item.name, item.brand, item.product_type));
      return {
        ...item,
        existing_product: match
          ? { id: match.id, selling_price: match.selling_price, quantity_in_stock: match.quantity_in_stock }
          : null,
      };
    }),
  };
}

export type OpenPurchaseOrder = { id: string; reference: string; supplier_name: string | null };

// Purchase orders a new shipment can be attached to (not yet received).
export async function getOpenPurchaseOrders(): Promise<OpenPurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, reference, suppliers(name)")
    .in("status", ["DRAFT", "SENT"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching open purchase orders:", error);
    return [];
  }
  return ((data ?? []) as unknown as { id: string; reference: string; suppliers: { name: string } | null }[]).map((po) => ({
    id: po.id,
    reference: po.reference,
    supplier_name: po.suppliers?.name ?? null,
  }));
}

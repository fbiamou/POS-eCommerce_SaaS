import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopSettings } from "@/features/settings/queries";
import { routing } from "@/i18n/routing";
import { DEFAULT_TIME_ZONE } from "@/lib/format";
import { buildExportFiles, withoutDeletedOrders, type ExportData } from "@/features/export/build";
import { buildZip } from "@/features/export/zip";

export const runtime = "nodejs";

// The full data export promised by the terms of use: everything the shop
// entered, as one .zip of CSV files, for the manager only. Row Level Security
// already limits every query to the manager's own shop.

const PAGE_SIZE = 1000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// PostgREST returns at most 1000 rows per request: read each table page by page.
async function fetchAll<T>(supabase: Supabase, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.role !== "MANAGER") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const locale = routing.locales.find((l) => l === requestedLocale) ?? routing.defaultLocale;
  const [t, settings, supabase] = await Promise.all([
    getTranslations({ locale, namespace: "Export" }),
    getShopSettings(),
    createClient(),
  ]);

  let data: ExportData;
  try {
    const [
      categories, suppliers, products, clients, profiles, invoices, invoiceItems, payments, stockMovements,
      purchaseOrders, purchaseOrderItems, shipments, shipmentItems, onlineOrders, onlineOrderItems, reminders,
    ] = await Promise.all([
      fetchAll<ExportData["categories"][number]>(supabase, "categories", "id, name"),
      fetchAll<ExportData["suppliers"][number]>(supabase, "suppliers", "id, name, phone, is_active, created_at"),
      fetchAll<ExportData["products"][number]>(
        supabase,
        "products",
        "id, name, category_id, product_type, brand, supplier, supplier_id, origin_country, purchase_price, selling_price, quantity_in_stock, is_published_online, is_active, description, image_url, created_at",
      ),
      fetchAll<ExportData["clients"][number]>(supabase, "clients", "id, name, phone, is_active, created_at"),
      fetchAll<ExportData["profiles"][number]>(supabase, "profiles", "id, full_name, role, is_active, created_at"),
      fetchAll<ExportData["invoices"][number]>(
        supabase,
        "invoices",
        "id, invoice_number, client_id, total_amount, discount_amount, paid_amount, status, loyalty_reward_used, created_by, created_at",
      ),
      fetchAll<ExportData["invoiceItems"][number]>(supabase, "invoice_items", "invoice_id, product_id, quantity, unit_price, total_price"),
      fetchAll<ExportData["payments"][number]>(supabase, "payments", "invoice_id, amount, payment_date, recorded_by"),
      fetchAll<ExportData["stockMovements"][number]>(supabase, "stock_movements", "product_id, type, quantity_change, created_at, created_by"),
      fetchAll<ExportData["purchaseOrders"][number] & { deleted_at: string | null }>(
        supabase,
        "purchase_orders",
        "id, reference, supplier_id, status, created_at, sent_at, received_at, deleted_at",
      ),
      fetchAll<ExportData["purchaseOrderItems"][number]>(
        supabase,
        "purchase_order_items",
        "purchase_order_id, product_id, quantity, received_quantity, excluded",
      ),
      fetchAll<ExportData["shipments"][number]>(
        supabase,
        "shipments",
        "id, reference, intermediary_name, intermediary_phone, purchase_order_id, status, declared_at, received_at",
      ),
      fetchAll<ExportData["shipmentItems"][number]>(
        supabase,
        "shipment_items",
        "shipment_id, name, category_name, product_type, brand, unit_purchase_price, declared_quantity, received_quantity",
      ),
      fetchAll<ExportData["onlineOrders"][number]>(
        supabase,
        "online_orders",
        "id, customer_name, customer_phone, status, total_amount, invoice_id, created_at, confirmed_at",
      ),
      fetchAll<ExportData["onlineOrderItems"][number]>(supabase, "online_order_items", "order_id, product_id, quantity, unit_price, total_price"),
      fetchAll<ExportData["reminders"][number]>(supabase, "reminder_logs", "client_id, invoice_id, template_name, status, sent_at"),
    ]);
    const orders = withoutDeletedOrders(purchaseOrders, purchaseOrderItems);
    data = {
      shop: settings,
      categories, suppliers, products, clients, profiles, invoices, invoiceItems, payments, stockMovements,
      purchaseOrders: orders.orders, purchaseOrderItems: orders.lines,
      shipments, shipmentItems, onlineOrders, onlineOrderItems, reminders,
    };
  } catch (error) {
    console.error("Data export failed:", error);
    return NextResponse.json({ error: "generic_error" }, { status: 500 });
  }

  const files = buildExportFiles(data, (key) => t(key), settings?.timezone ?? DEFAULT_TIME_ZONE, locale);
  const zip = buildZip(files);
  const day = new Date().toISOString().slice(0, 10);
  const name = `wishop-${settings?.shop_slug || "export"}-${day}.zip`;

  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

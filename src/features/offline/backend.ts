import type { SupabaseClient } from "@supabase/supabase-js";
import { feedbackFromError } from "@/lib/feedback";
import type { LocalClient, LocalInvoiceItem, LocalMember, LocalPayment, LocalProduct, LocalSupplier } from "./db";
import type { Outcome, ServerInvoice, ShopSnapshot, SyncBackend } from "./sync";

// The sync engine's link to Supabase, from the browser with the signed-in
// user's session (RLS keeps each shop to its own rows). Writes go through the
// same database functions as online; reads are paged, oldest change first.

/** A request that never answers (Wi-Fi without internet) counts as offline. */
const DEFAULT_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 1000;
const INVOICE_PAGE_SIZE = 500;

type Response = { error: { message?: string; code?: string } | null; status: number };

/**
 * No answer, a server that is busy or down, an expired session, or a function
 * the server does not have yet: try again later, nothing is lost. Anything
 * else is a refusal (stock, amount, plan...): the operation is set aside.
 */
function refusal(response: Response): Outcome<never> {
  const { status } = response;
  const retry = status === 0 || status >= 500 || status === 401 || status === 404 || status === 408 || status === 429;
  return { ok: false, network: retry, code: feedbackFromError(response.error) };
}

async function guarded<T>(run: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
  try {
    return await run();
  } catch {
    return { ok: false, network: true, code: "generic_error" };
  }
}


type ProductRow = Omit<LocalProduct, "category_name"> & { updated_at: string; categories: { name: string } | null };
type ClientRow = LocalClient & { updated_at: string };
type InvoiceRow = Omit<ServerInvoice, "client_name" | "client_phone" | "seller_name" | "items" | "payments"> & {
  clients: { name: string; phone: string | null } | null;
  seller: { full_name: string | null } | null;
  invoice_items: (Omit<LocalInvoiceItem, "invoice_id" | "product_name"> & { products: { name: string } | null })[];
  payments: Omit<LocalPayment, "invoice_id">[];
};

const PRODUCT_COLUMNS =
  "id, name, brand, product_type, supplier_id, origin_country, quantity_in_stock, purchase_price, selling_price, description, image_url, is_published_online, is_active, updated_at, categories(name)";
const CLIENT_COLUMNS = "id, name, phone, is_active, created_at, updated_at";
const INVOICE_COLUMNS = `id, invoice_number, client_id, total_amount, paid_amount, discount_amount, loyalty_reward_used, status,
  created_at, updated_at, recorded_offline,
  clients ( name, phone ),
  seller:profiles!invoices_created_by_fkey ( full_name ),
  invoice_items ( id, product_id, quantity, unit_price, total_price, products ( name ) ),
  payments ( id, amount, payment_date )`;
const SHOP_COLUMNS =
  "shop_name, shop_phone, shop_address, shop_email, shop_logo_url, tax_id, trade_register, country_code, vat_registered, vat_rate_bps, currency_symbol, default_phone_country_code, low_stock_threshold, timezone, loyalty_enabled, loyalty_stamps_required, loyalty_reward_percent";

export function supabaseBackend(supabase: SupabaseClient, shopId: string, options: { timeoutMs?: number } = {}): SyncBackend {
  const timeout = () => AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  async function rpc(fn: string, args: Record<string, unknown>): Promise<Outcome<null>> {
    return guarded(async () => {
      const response = await supabase.rpc(fn, args).abortSignal(timeout());
      return response.error ? refusal(response) : { ok: true, data: null };
    });
  }

  async function pages<Row>(table: string, columns: string, since: string | null, pageSize: number): Promise<Outcome<Row[]>> {
    return guarded(async () => {
      const rows: Row[] = [];
      for (let from = 0; ; from += pageSize) {
        let query = supabase.from(table).select(columns).order("updated_at").order("id").range(from, from + pageSize - 1);
        if (since) query = query.gte("updated_at", since);
        const response = await query.abortSignal(timeout());
        if (response.error) return refusal(response);
        const page = (response.data ?? []) as unknown as Row[];
        rows.push(...page);
        if (page.length < pageSize) return { ok: true, data: rows };
      }
    });
  }

  return {
    recordClient: (p, offline) =>
      rpc("record_client", { _client_id: p.client_id, _name: p.name, _phone: p.phone, _created_at: offline ? p.created_at : null }),

    recordSale: (p, offline) =>
      rpc("record_sale", {
        _shop_id: shopId,
        _client_id: p.client_id,
        _items: p.items,
        _paid_amount: p.paid_amount,
        _use_loyalty_reward: p.use_loyalty_reward,
        _invoice_id: p.invoice_id,
        _device_id: p.device_id,
        _device_seq: p.device_seq,
        _sold_at: offline ? p.sold_at : null,
        _seller_id: p.seller_id,
      }),

    recordPayment: (p, offline) =>
      rpc("record_payment", {
        _shop_id: shopId,
        _invoice_id: p.invoice_id,
        _amount: p.amount,
        _payment_id: p.payment_id,
        _paid_at: offline ? p.paid_at : null,
        _recorded_by: p.recorded_by,
      }),

    async pullProducts(since) {
      const outcome = await pages<ProductRow>("products", PRODUCT_COLUMNS, since, PAGE_SIZE);
      if (!outcome.ok) return outcome;
      return {
        ok: true,
        data: outcome.data.map(({ categories, ...row }) => ({ ...row, category_name: categories?.name ?? null })),
      };
    },

    pullClients(since) {
      return pages<ClientRow>("clients", CLIENT_COLUMNS, since, PAGE_SIZE);
    },

    async pullInvoices(since) {
      const outcome = await pages<InvoiceRow>("invoices", INVOICE_COLUMNS, since, INVOICE_PAGE_SIZE);
      if (!outcome.ok) return outcome;
      return {
        ok: true,
        data: outcome.data.map(({ clients, seller, invoice_items, payments, ...row }) => ({
          ...row,
          seller_name: seller?.full_name?.trim() || null,
          discount_amount: row.discount_amount ?? 0,
          recorded_offline: Boolean(row.recorded_offline),
          client_name: clients?.name ?? null,
          client_phone: clients?.phone ?? null,
          items: (invoice_items ?? []).map(({ products, ...item }) => ({
            ...item,
            invoice_id: row.id,
            product_name: products?.name ?? "—",
          })),
          payments: (payments ?? []).map((payment) => ({ ...payment, invoice_id: row.id })),
        })),
      };
    },

    recordProduct: (p, offline) =>
      rpc("record_product", {
        _product_id: p.product_id,
        _name: p.name,
        _category: p.category,
        _brand: p.brand,
        _product_type: p.product_type,
        _supplier_id: p.supplier_id,
        _origin_country: p.origin_country,
        _purchase_price: p.purchase_price,
        _selling_price: p.selling_price,
        _description: p.description,
        _is_published_online: p.is_published_online,
        _opening_stock: p.opening_stock,
        _created_at: offline ? p.created_at : null,
      }),

    updateProductOffline: (p) =>
      rpc("update_product_offline", {
        _product_id: p.product_id,
        _change_id: p.change_id,
        _name: p.name,
        _category: p.category,
        _brand: p.brand,
        _product_type: p.product_type,
        _supplier_id: p.supplier_id,
        _origin_country: p.origin_country,
        _purchase_price: p.purchase_price,
        _selling_price: p.selling_price,
        _description: p.description,
        _is_published_online: p.is_published_online,
        _stock_delta: p.stock_delta,
        _changed_at: p.changed_at,
      }),

    receivePurchaseOrderOffline: (p) =>
      rpc("receive_purchase_order_offline", {
        _shop_id: shopId,
        _order_id: p.order_id,
        _received: p.entries,
        _received_at: p.received_at,
      }),

    pullSuppliers() {
      return guarded(async () => {
        const response = await supabase.from("suppliers").select("id, name, is_active").order("name").abortSignal(timeout());
        if (response.error) return refusal(response);
        return { ok: true, data: (response.data ?? []) as LocalSupplier[] };
      });
    },

    pullMembers() {
      return guarded(async () => {
        const response = await supabase
          .from("profiles")
          .select("id, full_name, role, is_active, allowed_pages, pin_salt, pin_hash")
          .order("full_name")
          .abortSignal(timeout());
        if (response.error) return refusal(response);
        return { ok: true, data: (response.data ?? []) as LocalMember[] };
      });
    },

    pullShop() {
      return guarded(async () => {
        const response = await supabase.from("settings").select(SHOP_COLUMNS).abortSignal(timeout()).maybeSingle();
        if (response.error) return refusal(response);
        return { ok: true, data: (response.data as ShopSnapshot | null) ?? null };
      });
    },
  };
}

/** Registers this device as a till, or finds it again (see register_device). */
export async function registerDevice(
  supabase: SupabaseClient,
  deviceId: string | null,
  label: string
): Promise<{ device_id: string; device_number: number; last_seq: number } | null> {
  try {
    const { data, error } = await supabase
      .rpc("register_device", { _device_id: deviceId, _label: label })
      .abortSignal(AbortSignal.timeout(DEFAULT_TIMEOUT_MS));
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data[0] as { device_id: string; device_number: number; last_seq: number };
  } catch {
    return null;
  }
}

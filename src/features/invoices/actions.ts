import { createClient } from "@/utils/supabase/server";

export type InvoiceListItem = {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  paid_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  created_at: string;
  client_name: string | null;
};

export async function getInvoices(): Promise<InvoiceListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, paid_amount, status, created_at, clients ( name )")
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("Error fetching invoices:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    total_amount: row.total_amount,
    paid_amount: row.paid_amount,
    status: row.status,
    created_at: row.created_at,
    client_name: (row.clients as unknown as { name: string } | null)?.name ?? null,
  }));
}

export type InvoiceDetail = {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  paid_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  created_at: string;
  /** Loyalty reward taken off the sum of the lines (0 when none). */
  discount_amount: number;
  client: { name: string; phone: string | null } | null;
  /** Name of the team member who recorded the sale, printed on the ticket. */
  seller_name: string | null;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_name: string;
  }[];
  payments: { id: string; amount: number; payment_date: string }[];
};

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id, invoice_number, total_amount, paid_amount, status, created_at, discount_amount,
      clients ( name, phone ),
      seller:profiles!invoices_created_by_fkey ( full_name ),
      invoice_items ( id, quantity, unit_price, total_price, products ( name ) ),
      payments ( id, amount, payment_date )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const client = data.clients as unknown as { name: string; phone: string | null } | null;
  // Every member of the shop can read the team's names (profiles RLS), so a
  // seller reprinting a colleague's ticket still sees who made the sale.
  const seller = data.seller as unknown as { full_name: string | null } | null;
  const items = data.invoice_items as unknown as {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { name: string } | null;
  }[];
  const payments = (data.payments ?? []) as unknown as { id: string; amount: number; payment_date: string }[];

  return {
    id: data.id,
    invoice_number: data.invoice_number,
    total_amount: data.total_amount,
    paid_amount: data.paid_amount,
    discount_amount: data.discount_amount ?? 0,
    status: data.status,
    created_at: data.created_at,
    client: client ? { name: client.name, phone: client.phone } : null,
    seller_name: seller?.full_name?.trim() || null,
    items: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      product_name: item.products?.name ?? "—",
    })),
    payments: [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)),
  };
}

// Extracts the VAT amount embedded in a VAT-inclusive total, rounded so that
// (excludingVat + vatAmount) always sums back exactly to totalAmount.
export function extractVat(totalAmount: number, vatRateBps: number) {
  const excludingVat = Math.round((totalAmount * 10000) / (10000 + vatRateBps));
  const vatAmount = totalAmount - excludingVat;
  return { excludingVat, vatAmount };
}

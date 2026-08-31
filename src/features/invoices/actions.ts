import { createClient } from "@/utils/supabase/server";

export type InvoiceDetail = {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  paid_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  created_at: string;
  client: { name: string; phone: string | null } | null;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_name: string;
  }[];
};

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id, invoice_number, total_amount, paid_amount, status, created_at,
      clients ( name, phone ),
      invoice_items ( id, quantity, unit_price, total_price, products ( name ) )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const client = data.clients as unknown as { name: string; phone: string | null } | null;
  const items = data.invoice_items as unknown as {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { name: string } | null;
  }[];

  return {
    id: data.id,
    invoice_number: data.invoice_number,
    total_amount: data.total_amount,
    paid_amount: data.paid_amount,
    status: data.status,
    created_at: data.created_at,
    client: client ? { name: client.name, phone: client.phone } : null,
    items: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      product_name: item.products?.name ?? "—",
    })),
  };
}

// Extracts the VAT amount embedded in a VAT-inclusive total, rounded so that
// (excludingVat + vatAmount) always sums back exactly to totalAmount.
export function extractVat(totalAmount: number, vatRateBps: number) {
  const excludingVat = Math.round((totalAmount * 10000) / (10000 + vatRateBps));
  const vatAmount = totalAmount - excludingVat;
  return { excludingVat, vatAmount };
}

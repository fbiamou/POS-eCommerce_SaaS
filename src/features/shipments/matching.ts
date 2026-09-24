// Shared rules for shipments, kept pure so they can be unit-tested and used
// on both the server and the intermediary's page.

// Same product = same name, brand and type, ignoring case and surrounding
// spaces. This mirrors the matching done by the receive_shipment database
// function, so the screen announces exactly what the validation will do.
export function productKey(name: string, brand: string | null | undefined, type: string | null | undefined): string {
  const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  return `${norm(name)}|${norm(brand)}|${norm(type)}`;
}

// Public link the intermediary opens, in the shop staff's current language.
export function buildIntakeUrl(origin: string, locale: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/${locale}/procurement/${token}`;
}

export type DeclaredItem = {
  name: string;
  category: string;
  type: string;
  brand: string;
  unit_price: number;
  quantity: number;
};

// What the intermediary typed, cleaned before being sent: trimmed text,
// whole positive quantities, a non-negative price (0 when unknown).
export function normalizeDeclaredItem(input: {
  name: string;
  category?: string;
  type?: string;
  brand?: string;
  unit_price?: string | number;
  quantity: string | number;
}): DeclaredItem | null {
  const name = input.name.trim();
  const quantity = Number(input.quantity);
  const price = input.unit_price === undefined || input.unit_price === "" ? 0 : Number(input.unit_price);
  if (!name || !Number.isInteger(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    name,
    category: (input.category ?? "").trim(),
    type: (input.type ?? "").trim(),
    brand: (input.brand ?? "").trim(),
    unit_price: Math.round(price),
    quantity,
  };
}

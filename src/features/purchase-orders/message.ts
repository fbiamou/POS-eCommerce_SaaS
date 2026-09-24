// Pure helpers for the order sent to a supplier (WhatsApp text and PDF),
// kept free of React so they can be unit-tested.

type OrderLine = {
  name: string;
  brand: string | null;
  product_type: string | null;
  quantity: number;
  excluded: boolean;
};

// "Perruque lisse 20 pouces (Lisse, LuxeHair)": the supplier needs the type
// and brand to pick the right item.
export function describeOrderedItem(line: Pick<OrderLine, "name" | "brand" | "product_type">): string {
  const details = [line.product_type, line.brand].filter((value): value is string => Boolean(value && value.trim()));
  return details.length > 0 ? `${line.name} (${details.join(", ")})` : line.name;
}

// One "8 × item" line per product actually ordered, excluded lines left out.
export function orderLines(lines: OrderLine[]): string[] {
  return lines.filter((line) => !line.excluded).map((line) => `${line.quantity} × ${describeOrderedItem(line)}`);
}

export function buildOrderMessage(header: string, lines: OrderLine[], footer: string): string {
  return [header, "", ...orderLines(lines).map((line) => `- ${line}`), "", footer].join("\n");
}

// Pure helpers for checking off a delivered purchase order (AGENTS.md: every
// stock calculation is tested). The owner types what actually arrived; only
// those quantities enter the stock, through receive_purchase_order.

type ReceptionLine = {
  id: string;
  quantity: number;
  excluded: boolean;
};

export type ReceivedEntry = { item_id: string; received_quantity: number };

// Every ordered line starts at the ordered quantity: most deliveries are
// complete, so the owner only corrects what is missing.
export function initialReceived(lines: ReceptionLine[]): Record<string, string> {
  return Object.fromEntries(lines.filter((line) => !line.excluded).map((line) => [line.id, String(line.quantity)]));
}

// A received quantity is a whole number, zero or more (zero: not delivered).
function parseQuantity(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function buildReceivedPayload(
  lines: ReceptionLine[],
  received: Record<string, string>
): { entries: ReceivedEntry[] } | { error: "invalid_quantity" } {
  const entries: ReceivedEntry[] = [];
  for (const line of lines) {
    if (line.excluded) continue;
    const quantity = parseQuantity(received[line.id]);
    if (quantity === null) return { error: "invalid_quantity" };
    entries.push({ item_id: line.id, received_quantity: quantity });
  }
  return { entries };
}

// What the confirmation screen says: units entering the stock, and the lines
// delivered short (fewer than ordered) or over (more than ordered).
export function receptionSummary(lines: ReceptionLine[], entries: ReceivedEntry[]) {
  const ordered = new Map(lines.map((line) => [line.id, line.quantity]));
  let units = 0;
  let shortLines = 0;
  let overLines = 0;
  for (const entry of entries) {
    units += entry.received_quantity;
    const expected = ordered.get(entry.item_id) ?? 0;
    if (entry.received_quantity < expected) shortLines += 1;
    if (entry.received_quantity > expected) overLines += 1;
  }
  return { units, shortLines, overLines };
}

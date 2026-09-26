// Till codes (set_member_pin in the database): the device checks a code
// against the member's fingerprint, SHA-256 of salt + code, the same
// computation as the database, so it works without internet.

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pinMatches(pin: string, salt: string | null, hash: string | null): Promise<boolean> {
  if (!salt || !hash || !isValidPin(pin)) return false;
  return (await sha256Hex(salt + pin)) === hash;
}

// The person selling on this device. It starts as the signed-in account and
// changes when someone types their code; it goes back to the account when
// another person signs in on the device.
export type Cashier = { id: string; name: string | null };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function key(shopId: string) {
  return `wishop-cashier-${shopId}`;
}

export function readCashier(storage: Storage, shopId: string, sessionUserId: string): Cashier | null {
  try {
    const raw = storage.getItem(key(shopId));
    if (!raw) return null;
    const value = JSON.parse(raw) as { sessionUserId?: string; id?: string; name?: string | null };
    if (value.sessionUserId !== sessionUserId || typeof value.id !== "string") return null;
    return { id: value.id, name: value.name ?? null };
  } catch {
    return null;
  }
}

/** The shop's calendar day (YYYY-MM-DD), for "who is selling today". */
export function shopDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The till asks "who is selling?" at its first opening of the day on the
// device (decided 26/09/2026); this remembers the day someone answered.
function dayKey(shopId: string) {
  return `wishop-cashier-day-${shopId}`;
}

export function readCashierDay(storage: Pick<Storage, "getItem">, shopId: string): string | null {
  try {
    return storage.getItem(dayKey(shopId));
  } catch {
    return null;
  }
}

export function writeCashierDay(storage: Pick<Storage, "setItem">, shopId: string, day: string) {
  try {
    storage.setItem(dayKey(shopId), day);
  } catch {
    // Storage blocked: the question comes back at the next opening.
  }
}

/**
 * Keeps the holder's page access next to her name, so the page can check it
 * before it is even drawn (tillPrecheck.ts), online and offline.
 */
export function writeTillRights(
  storage: Storage,
  shopId: string,
  sessionUserId: string,
  holder: { id: string; role: string; allowed_pages: string[] }
) {
  try {
    const raw = storage.getItem(key(shopId));
    if (!raw) return;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.sessionUserId !== sessionUserId || value.id !== holder.id) return;
    if (value.role === holder.role && JSON.stringify(value.allowed_pages) === JSON.stringify(holder.allowed_pages)) return;
    storage.setItem(key(shopId), JSON.stringify({ ...value, role: holder.role, allowed_pages: holder.allowed_pages }));
  } catch {
    // Storage blocked: the page guard (CashierGuard) still applies her rights.
  }
}

export function writeCashier(storage: Storage, shopId: string, sessionUserId: string, cashier: Cashier | null) {
  if (!cashier || cashier.id === sessionUserId) {
    storage.removeItem(key(shopId));
    return;
  }
  storage.setItem(key(shopId), JSON.stringify({ sessionUserId, id: cashier.id, name: cashier.name }));
}

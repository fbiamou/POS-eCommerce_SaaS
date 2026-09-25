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

export function writeCashier(storage: Storage, shopId: string, sessionUserId: string, cashier: Cashier | null) {
  if (!cashier || cashier.id === sessionUserId) {
    storage.removeItem(key(shopId));
    return;
  }
  storage.setItem(key(shopId), JSON.stringify({ sessionUserId, id: cashier.id, name: cashier.name }));
}

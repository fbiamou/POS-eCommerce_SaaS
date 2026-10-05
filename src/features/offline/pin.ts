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

// Wrong codes checked on the device (a colleague's code, kept as a
// fingerprint): after PIN_MAX_TRIES in a row the code is refused for
// PIN_LOCK_MINUTES, like the server does for the codes it checks. Counted per
// device and per person; a right code clears the count.
export const PIN_MAX_TRIES = 5;
export const PIN_LOCK_MINUTES = 15;

type Tries = { count: number; until: number | null };

function triesKey(shopId: string, memberId: string) {
  return `wishop-pin-tries-${shopId}-${memberId}`;
}

function readTries(storage: Pick<globalThis.Storage, "getItem">, shopId: string, memberId: string): Tries {
  try {
    const raw = storage.getItem(triesKey(shopId, memberId));
    const parsed = raw ? (JSON.parse(raw) as Tries) : null;
    return parsed && typeof parsed.count === "number" ? parsed : { count: 0, until: null };
  } catch {
    return { count: 0, until: null };
  }
}

/** The time until which this person's code is refused, or null. */
export function pinLockedUntil(storage: Pick<globalThis.Storage, "getItem">, shopId: string, memberId: string, now: number = Date.now()): number | null {
  const { until } = readTries(storage, shopId, memberId);
  return until !== null && until > now ? until : null;
}

/** Counts a wrong code; returns the lock's end once the limit is reached. */
export function recordPinFailure(
  storage: Pick<globalThis.Storage, "getItem" | "setItem">,
  shopId: string,
  memberId: string,
  now: number = Date.now(),
): number | null {
  const previous = readTries(storage, shopId, memberId);
  // A lock that has ended starts a new count.
  const count = (previous.until !== null && previous.until <= now ? 0 : previous.count) + 1;
  const until = count >= PIN_MAX_TRIES ? now + PIN_LOCK_MINUTES * 60_000 : null;
  try {
    storage.setItem(triesKey(shopId, memberId), JSON.stringify({ count: until ? 0 : count, until }));
  } catch {}
  return until;
}

export function clearPinFailures(storage: Pick<globalThis.Storage, "removeItem">, shopId: string, memberId: string) {
  try {
    storage.removeItem(triesKey(shopId, memberId));
  } catch {}
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

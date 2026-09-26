// Who holds the till on a device signed in with another account (till code,
// features/offline/components/CashierSwitcher). While a colleague holds it,
// the server applies her rights, not the account's: only the pages the
// owner opened to her, no settings (decided 26/09/2026).
//
// The server keeps this in a signed, httpOnly cookie: the page cannot read
// or change it, and it only counts for the account it was made for. The
// signature uses a server secret; it runs in the proxy and in server code
// alike (Web Crypto).

export const CASHIER_COOKIE = "wishop_cashier";

function secret(): string {
  const value = process.env.CASHIER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("No secret to sign the till holder");
  return value;
}

async function sign(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The cookie value: the member holding the till, for this signed-in account. */
export async function cashierCookieValue(sessionUserId: string, memberId: string): Promise<string> {
  return `${memberId}.${await sign(`${sessionUserId}:${memberId}`)}`;
}

/** The member holding the till, when the cookie is valid for this account. */
export async function cashierFromCookie(value: string | undefined, sessionUserId: string): Promise<string | null> {
  if (!value) return null;
  const [memberId, signature] = value.split(".");
  if (!memberId || !signature || memberId === sessionUserId) return null;
  try {
    return (await sign(`${sessionUserId}:${memberId}`)) === signature ? memberId : null;
  } catch {
    return null;
  }
}

export const CASHIER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // Long-lived: the account's own rights come back only through its till
  // code or a new sign-in, never because the cookie ran out. The device also
  // sets it again if it goes missing (OfflineProvider).
  maxAge: 30 * 24 * 60 * 60,
};

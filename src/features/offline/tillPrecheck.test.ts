import { describe, expect, it } from "vitest";
import { APP_PAGES, firstOpenPath, isPageAllowed } from "@/lib/appPages";
import { tillPrecheckScript } from "./tillPrecheck";

const SHOP = "shop-1";
const OWNER = "owner-1";

// Runs the inline script against a fake page: returns where it sends the
// browser (null when the page may show).
function run(pathname: string, stored: unknown, sessionUserId = OWNER): string | null {
  let sentTo: string | null = null;
  const storage = new Map<string, string>();
  if (stored) storage.set(`wishop-cashier-${SHOP}`, JSON.stringify(stored));
  const fakeLocalStorage = { getItem: (key: string) => storage.get(key) ?? null };
  const fakeLocation = { pathname, replace: (url: string) => (sentTo = url) };
  const fakeDocument = { documentElement: { style: {} as Record<string, string> } };
  new Function("localStorage", "location", "document", tillPrecheckScript(SHOP, sessionUserId))(fakeLocalStorage, fakeLocation, fakeDocument);
  return sentTo;
}

const seller = (allowed_pages: string[]) => ({ sessionUserId: OWNER, id: "seller-1", name: "Awa", role: "SELLER", allowed_pages });

describe("check made before the page is drawn", () => {
  it("sends the colleague holding the till from the settings to the till", () => {
    expect(run("/fr/settings", seller(["dashboard", "sales", "invoices"]))).toBe("/fr/sales");
    expect(run("/es/settings/team", seller([]))).toBe("/es/sales");
  });

  it("lets her open her own pages", () => {
    expect(run("/fr/sales", seller(["sales", "invoices"]))).toBeNull();
    expect(run("/fr/invoices/abc/ticket", seller(["sales", "invoices"]))).toBeNull();
  });

  it("closes the platform console to her", () => {
    expect(run("/fr/admin", seller([]))).toBe("/fr/sales");
  });

  it("does nothing when the account itself holds the till, or for another account", () => {
    expect(run("/fr/settings", null)).toBeNull();
    expect(run("/fr/settings", seller(["sales"]), "someone-else")).toBeNull();
    expect(run("/fr/settings", { sessionUserId: OWNER, id: "seller-1", name: "Awa" })).toBeNull();
  });

  it("follows the same rules as the server and the app (appPages.ts)", () => {
    const cases = [["sales", "invoices"], ["dashboard", "stock"], [], ["clients"], ["settings", "reminders"]];
    for (const allowed of cases) {
      for (const { path } of [...APP_PAGES, { path: "/invoices/abc" }]) {
        const expected = isPageAllowed("SELLER", allowed, path) ? null : `/fr${firstOpenPath("SELLER", allowed)}`;
        expect(run(`/fr${path}`, seller(allowed)), `${path} with ${allowed.join(",")}`).toBe(expected);
      }
    }
  });
});

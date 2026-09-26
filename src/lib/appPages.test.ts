import { describe, expect, it } from "vitest";
import { firstAllowedPath, firstOpenPath, isPageAllowed, matchPageKey } from "./appPages";

describe("matchPageKey", () => {
  it("recognises nested pages", () => {
    expect(matchPageKey("/invoices/abc123/ticket")).toBe("invoices");
    expect(matchPageKey("/dashboard")).toBe("dashboard");
    expect(matchPageKey("/unknown")).toBeNull();
  });
});

describe("isPageAllowed", () => {
  it("gives the Owner access to everything", () => {
    expect(isPageAllowed("MANAGER", ["sales"], "/settings")).toBe(true);
    expect(isPageAllowed("MANAGER", ["sales"], "/stock")).toBe(true);
  });

  it("keeps an unrestricted cashier out of the settings", () => {
    expect(isPageAllowed("SELLER", [], "/settings")).toBe(false);
    expect(isPageAllowed("SELLER", [], "/stock")).toBe(true);
  });

  it("limits a restricted cashier to the pages the Owner checked", () => {
    expect(isPageAllowed("SELLER", ["sales", "invoices"], "/invoices/abc")).toBe(true);
    expect(isPageAllowed("SELLER", ["sales", "invoices"], "/clients")).toBe(false);
    expect(isPageAllowed("SELLER", ["sales", "settings"], "/settings")).toBe(false);
  });
});

describe("firstAllowedPath", () => {
  it("sends a restricted cashier to their first page", () => {
    expect(firstAllowedPath(["invoices", "sales"])).toBe("/sales");
    expect(firstAllowedPath([])).toBe("/dashboard");
  });
});

describe("firstOpenPath", () => {
  it("sends an employee to the till when it is open to her, not to the dashboard", () => {
    expect(firstOpenPath("SELLER", ["dashboard", "invoices", "sales"])).toBe("/sales");
    expect(firstOpenPath("SELLER", [])).toBe("/sales");
    expect(firstOpenPath("SELLER", ["stock", "invoices"])).toBe("/stock");
    expect(firstOpenPath("MANAGER", [])).toBe("/dashboard");
  });

  it("never sends her to a page reserved to the owner (no endless redirect)", () => {
    expect(firstOpenPath("SELLER", ["settings", "clients"])).toBe("/clients");
    expect(firstOpenPath("SELLER", ["settings"])).toBeNull();
  });
});

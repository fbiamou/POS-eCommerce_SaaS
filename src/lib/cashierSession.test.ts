import { beforeAll, describe, expect, it } from "vitest";
import { cashierCookieValue, cashierFromCookie } from "./cashierSession";

beforeAll(() => {
  process.env.CASHIER_SESSION_SECRET = "test-secret";
});

describe("the till holder kept by the server", () => {
  it("is read back for the account that handed over the till", async () => {
    const value = await cashierCookieValue("owner", "awa");
    expect(await cashierFromCookie(value, "owner")).toBe("awa");
  });

  it("counts for nobody else: another account signed in on the device keeps its own rights", async () => {
    const value = await cashierCookieValue("owner", "awa");
    expect(await cashierFromCookie(value, "nadege")).toBeNull();
  });

  it("cannot be changed by hand to give someone else's rights", async () => {
    const value = await cashierCookieValue("owner", "awa");
    const [, signature] = value.split(".");
    expect(await cashierFromCookie(`co-owner.${signature}`, "owner")).toBeNull();
    expect(await cashierFromCookie("awa.0000", "owner")).toBeNull();
    expect(await cashierFromCookie(undefined, "owner")).toBeNull();
  });

  it("is never the account itself (its own rights need no cookie)", async () => {
    expect(await cashierFromCookie(await cashierCookieValue("owner", "owner"), "owner")).toBeNull();
  });
});

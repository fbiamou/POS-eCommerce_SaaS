import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidPin, pinMatches, readCashier, writeCashier } from "./pin";

// Same fingerprint as set_member_pin: sha256(salt || pin), in hexadecimal.
const salt = "3f1c9a0b7e2d4c5a8b6f0e1d2c3b4a59";
const hash = createHash("sha256").update(salt + "4821").digest("hex");

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("till codes", () => {
  it("accept exactly four digits", () => {
    expect(isValidPin("4821")).toBe(true);
    expect(isValidPin("482")).toBe(false);
    expect(isValidPin("48a1")).toBe(false);
    expect(isValidPin("48210")).toBe(false);
  });

  it("recognise the right code with the database's fingerprint, offline", async () => {
    expect(await pinMatches("4821", salt, hash)).toBe(true);
    expect(await pinMatches("4822", salt, hash)).toBe(false);
    expect(await pinMatches("4821", null, null)).toBe(false);
  });
});

describe("the person selling on the device", () => {
  it("is kept for the account signed in, and forgotten when another signs in", () => {
    const storage = memoryStorage();
    writeCashier(storage, "shop", "owner", { id: "awa", name: "Awa" });
    expect(readCashier(storage, "shop", "owner")).toEqual({ id: "awa", name: "Awa" });
    expect(readCashier(storage, "shop", "nadege")).toBeNull();
  });

  it("goes back to the signed-in account", () => {
    const storage = memoryStorage();
    writeCashier(storage, "shop", "owner", { id: "awa", name: "Awa" });
    writeCashier(storage, "shop", "owner", { id: "owner", name: "Fred" });
    expect(readCashier(storage, "shop", "owner")).toBeNull();
  });
});

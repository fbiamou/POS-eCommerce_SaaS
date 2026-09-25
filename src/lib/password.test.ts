import { describe, expect, it } from "vitest";
import { isStrongPassword, passwordIssues } from "./password";

describe("password strength", () => {
  it("refuses weak passwords and says what is missing", () => {
    expect(passwordIssues("1234")).toEqual(["length", "upper", "lower", "special"]);
    expect(passwordIssues("boutique")).toEqual(["upper", "digit", "special"]);
    expect(passwordIssues("Boutique2026")).toEqual(["special"]);
  });

  it("accepts a password with all five ingredients", () => {
    expect(isStrongPassword("Boutique-2026")).toBe(true);
    expect(isStrongPassword("Mama#B2026!")).toBe(true);
    expect(isStrongPassword("Ab1!")).toBe(false);
  });

  it("follows Supabase: only unaccented letters and keyboard symbols count", () => {
    // "É" is not an uppercase A-Z, "€" and "¿" are not in Supabase's symbols.
    expect(passwordIssues("Éclat#9mama")).toEqual(["upper"]);
    expect(passwordIssues("Boutique2026€")).toEqual(["special"]);
    expect(passwordIssues("¿Boutique2026?")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { isStrongPassword, passwordIssues } from "./password";

describe("password strength", () => {
  it("refuses weak passwords and says what is missing", () => {
    expect(passwordIssues("1234")).toEqual(["length", "upper", "lower", "special"]);
    expect(passwordIssues("boutique")).toEqual(["upper", "digit", "special"]);
    expect(passwordIssues("Boutique2026")).toEqual(["special"]);
  });

  it("accepts a password with all five ingredients, accents included", () => {
    expect(isStrongPassword("Boutique-2026")).toBe(true);
    expect(isStrongPassword("Éclat#9mamá")).toBe(true);
    expect(isStrongPassword("Ab1!")).toBe(false);
  });
});

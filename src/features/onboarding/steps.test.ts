import { describe, expect, it } from "vitest";
import { firstSteps, showFirstSteps } from "./steps";

const newShop = { shopDetailsFilled: false, productCount: 0, invoiceCount: 0, storefrontAddress: false, teamSize: 1 };

describe("first steps guide", () => {
  it("lists every step as to do for a brand-new shop", () => {
    const steps = firstSteps(newShop);
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ["shop", false],
      ["stock", false],
      ["sale", false],
      ["storefront", false],
      ["team", false],
    ]);
    expect(showFirstSteps(steps)).toBe(true);
  });

  it("ticks each step from the shop's real data", () => {
    const steps = firstSteps({ shopDetailsFilled: true, productCount: 12, invoiceCount: 1, storefrontAddress: false, teamSize: 2 });
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["shop", "stock", "sale", "team"]);
  });

  it("disappears once the required steps are done, even without a team", () => {
    const steps = firstSteps({ shopDetailsFilled: true, productCount: 3, invoiceCount: 5, storefrontAddress: true, teamSize: 1 });
    expect(showFirstSteps(steps)).toBe(false);
  });
});

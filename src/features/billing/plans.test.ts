import { describe, expect, it } from "vitest";
import { addMonths, effectivePlan, nextPaidUntil, suggestedAmount } from "./plans";

const now = new Date("2026-09-25T10:00:00Z");

describe("plans", () => {
  it("adds calendar months like Postgres, clamping to the end of the month", () => {
    expect(addMonths(new Date("2026-01-31T08:00:00Z"), 1).toISOString()).toBe("2026-02-28T08:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T08:00:00Z"), 1).toISOString()).toBe("2028-02-29T08:00:00.000Z");
    expect(addMonths(new Date("2026-09-25T10:00:00Z"), 2).toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-30T10:00:00Z"), 3).toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });

  it("falls back to Standard when there is no plan or the period is over", () => {
    expect(effectivePlan(null, now)).toBe("STANDARD");
    expect(effectivePlan({ plan: "PRO_PLUS", paid_until: "2026-11-25T10:00:00Z" }, now)).toBe("PRO_PLUS");
    expect(effectivePlan({ plan: "PRO", paid_until: "2026-09-25T09:59:00Z" }, now)).toBe("STANDARD");
    expect(effectivePlan({ plan: "PRO", paid_until: null }, now)).toBe("STANDARD");
  });

  it("extends the same running plan after its end date, otherwise starts today", () => {
    const running = { plan: "PRO" as const, paid_until: "2026-10-10T00:00:00Z" };
    expect(nextPaidUntil(running, "PRO", 1, now).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(nextPaidUntil(running, "PRO_PLUS", 2, now).toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(nextPaidUntil({ plan: "PRO", paid_until: "2026-09-01T00:00:00Z" }, "PRO", 1, now).toISOString()).toBe(
      "2026-10-25T10:00:00.000Z",
    );
    expect(nextPaidUntil(null, "ESSENTIEL", 12, now).toISOString()).toBe("2027-09-25T10:00:00.000Z");
  });

  it("suggests the launch price for each month", () => {
    expect(suggestedAmount("ESSENTIEL", 3)).toBe(15000);
    expect(suggestedAmount("PRO_PLUS", 2)).toBe(50000);
  });
});

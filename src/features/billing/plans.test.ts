import { describe, expect, it } from "vitest";
import { addMonths, nextPaidUntil, pausedMemberIds, planAllows, shopAccess, suggestedAmount } from "./plans";

const now = new Date("2026-09-25T10:00:00Z");

describe("plans", () => {
  it("adds calendar months like Postgres, clamping to the end of the month", () => {
    expect(addMonths(new Date("2026-01-31T08:00:00Z"), 1).toISOString()).toBe("2026-02-28T08:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T08:00:00Z"), 1).toISOString()).toBe("2028-02-29T08:00:00.000Z");
    expect(addMonths(new Date("2026-09-25T10:00:00Z"), 2).toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-30T10:00:00Z"), 3).toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });

  it("gives each feature from its plan upwards", () => {
    expect(planAllows("STANDARD", "credit")).toBe(false);
    expect(planAllows("ESSENTIEL", "credit")).toBe(true);
    expect(planAllows("ESSENTIEL", "storefront")).toBe(false);
    expect(planAllows("PRO", "storefront")).toBe(true);
    expect(planAllows("PRO", "shipments")).toBe(false);
    expect(planAllows("PRO_PLUS", "shipments")).toBe(true);
  });

  it("keeps a paid plan for 3 days after its end, then turns read-only", () => {
    expect(shopAccess(null, now).mode).toBe("active");
    expect(shopAccess({ plan: "STANDARD", paid_until: null }, now)).toEqual({ plan: "STANDARD", mode: "active", paidUntil: null, readOnlySince: null });
    expect(shopAccess({ plan: "PRO", paid_until: "2026-12-25T10:00:00Z" }, now).mode).toBe("active");
    expect(shopAccess({ plan: "PRO", paid_until: "2026-09-30T10:00:00Z" }, now).mode).toBe("ending_soon");
    const grace = shopAccess({ plan: "PRO", paid_until: "2026-09-24T10:00:00Z" }, now);
    expect(grace.mode).toBe("grace");
    expect(grace.readOnlySince).toBe("2026-09-27T10:00:00.000Z");
    expect(shopAccess({ plan: "PRO", paid_until: "2026-09-22T10:00:00Z" }, now).mode).toBe("read_only");
  });

  it("pauses the accounts beyond the plan, never the owner, oldest kept first", () => {
    const members = [
      { id: "seller-new", role: "SELLER", is_active: true, created_at: "2026-09-20T00:00:00Z" },
      { id: "owner", role: "MANAGER", is_active: true, created_at: "2026-08-30T00:00:00Z" },
      { id: "seller-old", role: "SELLER", is_active: true, created_at: "2026-09-01T00:00:00Z" },
      { id: "seller-off", role: "SELLER", is_active: false, created_at: "2026-09-02T00:00:00Z" },
    ];
    expect([...pausedMemberIds(members, "STANDARD")].sort()).toEqual(["seller-new", "seller-old"]);
    expect([...pausedMemberIds(members, "ESSENTIEL")]).toEqual(["seller-new"]);
    expect(pausedMemberIds(members, "PRO").size).toBe(0);
    expect(pausedMemberIds(members, "PRO_PLUS").size).toBe(0);
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

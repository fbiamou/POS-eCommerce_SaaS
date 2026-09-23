import { describe, expect, it } from "vitest";
import { computeClientStats, isLoyalClient } from "./stats";

const now = new Date("2026-09-23T12:00:00Z");
const invoice = (total: number, paid: number, date: string) => ({ total_amount: total, paid_amount: paid, created_at: date });

describe("computeClientStats", () => {
  it("adds up purchases, spending and what is still owed", () => {
    const stats = computeClientStats(
      [
        invoice(13000, 10000, "2026-08-31T10:00:00Z"),
        invoice(5000, 5000, "2026-09-10T10:00:00Z"),
        invoice(2000, 0, "2026-09-12T10:00:00Z"),
      ],
      now
    );
    expect(stats).toEqual({
      total_purchases: 3,
      recent_purchases: 3,
      total_spent: 20000,
      total_debt: 5000,
      first_purchase_date: "2026-08-31T10:00:00Z",
    });
  });

  it("never counts an overpaid invoice as a negative debt", () => {
    const stats = computeClientStats(
      [invoice(1000, 1500, "2026-09-01T00:00:00Z"), invoice(2000, 0, "2026-09-02T00:00:00Z")],
      now
    );
    expect(stats.total_debt).toBe(2000);
  });

  it("only counts the last 90 days as recent purchases", () => {
    const stats = computeClientStats(
      [invoice(1000, 1000, "2026-06-01T00:00:00Z"), invoice(1000, 1000, "2026-09-01T00:00:00Z")],
      now
    );
    expect(stats.total_purchases).toBe(2);
    expect(stats.recent_purchases).toBe(1);
  });

  it("handles a client with no purchase yet", () => {
    expect(computeClientStats([], now)).toEqual({
      total_purchases: 0,
      recent_purchases: 0,
      total_spent: 0,
      total_debt: 0,
      first_purchase_date: null,
    });
  });
});

describe("isLoyalClient: at least 3 purchases over the last 90 days", () => {
  it("is loyal with 3 recent purchases", () => {
    const stats = computeClientStats(
      [
        invoice(1000, 1000, "2026-07-01T00:00:00Z"),
        invoice(1000, 1000, "2026-08-15T00:00:00Z"),
        invoice(1000, 1000, "2026-09-20T00:00:00Z"),
      ],
      now
    );
    expect(isLoyalClient(stats)).toBe(true);
  });

  it("is not loyal with only 2 recent purchases, however many old ones", () => {
    const old = Array.from({ length: 10 }, () => invoice(1000, 1000, "2026-01-15T00:00:00Z"));
    const stats = computeClientStats(
      [...old, invoice(1000, 1000, "2026-09-01T00:00:00Z"), invoice(1000, 1000, "2026-09-20T00:00:00Z")],
      now
    );
    expect(isLoyalClient(stats)).toBe(false);
  });

  it("is not loyal for a single purchase made long ago (the old rule's mistake)", () => {
    expect(isLoyalClient(computeClientStats([invoice(1000, 1000, "2026-03-01T00:00:00Z")], now))).toBe(false);
  });

  it("is not loyal without any purchase", () => {
    expect(isLoyalClient(computeClientStats([], now))).toBe(false);
  });
});

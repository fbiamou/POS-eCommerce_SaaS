import { describe, expect, it } from "vitest";
import { loyaltyCard, loyaltyDiscount, type LoyaltyInvoice } from "./loyalty";

const paid = (n: number): LoyaltyInvoice[] => Array.from({ length: n }, () => ({ status: "PAID", loyalty_reward_used: false }));
const reward: LoyaltyInvoice = { status: "PAID", loyalty_reward_used: true };

describe("stamp card", () => {
  it("counts one stamp per sale paid in full", () => {
    expect(loyaltyCard(paid(7), 10)).toEqual({ stamps: 7, stampsRequired: 10, rewardAvailable: false });
  });

  it("does not stamp a sale until it is fully paid", () => {
    const invoices: LoyaltyInvoice[] = [...paid(2), { status: "PARTIAL", loyalty_reward_used: false }, { status: "UNPAID", loyalty_reward_used: false }];
    expect(loyaltyCard(invoices, 10).stamps).toBe(2);
  });

  it("offers the reward once the card is full, and keeps the card full until it is used", () => {
    expect(loyaltyCard(paid(10), 10)).toEqual({ stamps: 10, stampsRequired: 10, rewardAvailable: true });
    expect(loyaltyCard(paid(12), 10)).toEqual({ stamps: 10, stampsRequired: 10, rewardAvailable: true });
  });

  it("starts a new card after the reward is used, the reward sale earning no stamp", () => {
    expect(loyaltyCard([...paid(10), reward], 10)).toEqual({ stamps: 0, stampsRequired: 10, rewardAvailable: false });
    expect(loyaltyCard([...paid(13), reward], 10)).toEqual({ stamps: 3, stampsRequired: 10, rewardAvailable: false });
  });

  it("offers a second reward after a second full card", () => {
    expect(loyaltyCard([...paid(20), reward], 10).rewardAvailable).toBe(true);
  });

  it("offers nothing when the shop turned the card off", () => {
    expect(loyaltyCard(paid(10), 10, false).rewardAvailable).toBe(false);
  });

  it("rounds the discount to the franc", () => {
    expect(loyaltyDiscount(23700, 10)).toBe(2370);
    expect(loyaltyDiscount(7905, 10)).toBe(791);
    expect(loyaltyDiscount(0, 10)).toBe(0);
  });
});

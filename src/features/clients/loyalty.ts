// The stamp card (AGENTS.md: every calculation is tested). Same rule as the
// database function loyalty_reward_available (migration
// 20260925100000_loyalty_stamp_card_signup_shop), which has the last word
// when a sale uses a reward.
//
// - A sale paid in full earns one stamp; a credit sale earns it once settled
//   (its status becomes PAID). The sale that uses a reward earns none.
// - Each full card gives one reward on the next purchase.

export type LoyaltyInvoice = {
  status: "PAID" | "PARTIAL" | "UNPAID";
  loyalty_reward_used: boolean;
};

export type LoyaltyCard = {
  /** Stamps on the current card, from 0 to stampsRequired. */
  stamps: number;
  stampsRequired: number;
  /** A full card not yet used: the next purchase gets the reward. */
  rewardAvailable: boolean;
};

export function loyaltyCard(invoices: LoyaltyInvoice[], stampsRequired: number, enabled = true): LoyaltyCard {
  const required = Math.max(1, Math.floor(stampsRequired));
  const earned = invoices.filter((inv) => inv.status === "PAID" && !inv.loyalty_reward_used).length;
  const used = invoices.filter((inv) => inv.loyalty_reward_used).length;
  const fullCards = Math.floor(earned / required);
  const rewardAvailable = enabled && fullCards > used;
  return {
    stamps: rewardAvailable ? required : earned % required,
    stampsRequired: required,
    rewardAvailable,
  };
}

// The discount the till shows; the database computes the same rounding.
export function loyaltyDiscount(subtotal: number, rewardPercent: number): number {
  return Math.round((subtotal * rewardPercent) / 100);
}

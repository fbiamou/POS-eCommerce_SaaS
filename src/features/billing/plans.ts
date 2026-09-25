// WISHOP plans (public pricing grid, decided September 2026). Amounts in XAF,
// all taxes included. A shop that subscribes during the launch keeps the
// launch price for 12 months; the normal price applies after that.
//
// A shop starts on Standard (free). Paid months are granted or recorded by a
// platform admin (supabase: admin_extend_plan); past its end date a paid plan
// falls back to Standard.

export const PLANS = ["STANDARD", "ESSENTIEL", "PRO", "PRO_PLUS"] as const;
export type Plan = (typeof PLANS)[number];

export const PAID_PLANS = ["ESSENTIEL", "PRO", "PRO_PLUS"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const PLAN_PRICES: Record<PaidPlan, { launch: number; normal: number }> = {
  ESSENTIEL: { launch: 5000, normal: 7500 },
  PRO: { launch: 12500, normal: 17500 },
  PRO_PLUS: { launch: 25000, normal: 35000 },
};

export const PAYMENT_METHODS = ["MUNI_DINERO", "BANK_TRANSFER", "CASH", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MAX_MONTHS = 36;

export type SubscriptionState = { plan: Plan; paid_until: string | null };

export function isPaidPlan(value: string): value is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(value);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

// The plan the shop actually has today: Standard when it has none, or when
// its paid period is over.
export function effectivePlan(subscription: SubscriptionState | null, now: Date): Plan {
  if (!subscription || subscription.plan === "STANDARD") return "STANDARD";
  if (!subscription.paid_until || new Date(subscription.paid_until) <= now) return "STANDARD";
  return subscription.plan;
}

// Calendar months, the way Postgres adds an interval: 31 January + 1 month is
// 28 (or 29) February, never 3 March.
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

// Mirrors admin_extend_plan: the same plan still running gets the months
// after its end date; another plan, or an ended period, starts today.
export function nextPaidUntil(current: SubscriptionState | null, plan: PaidPlan, months: number, now: Date): Date {
  const running = current && current.plan === plan && current.paid_until && new Date(current.paid_until) > now;
  const start = running ? new Date(current.paid_until as string) : now;
  return addMonths(start, months);
}

// Suggested amount for a payment: the launch price for each month.
export function suggestedAmount(plan: PaidPlan, months: number): number {
  return PLAN_PRICES[plan].launch * months;
}

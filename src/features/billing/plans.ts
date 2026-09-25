// WISHOP plans (public pricing grid, decided September 2026). Amounts in XAF,
// all taxes included. A shop that subscribes during the launch keeps the
// launch price for 12 months; the normal price applies after that.
//
// A shop starts on Standard (free). Paid months are granted or recorded by a
// platform admin (supabase: admin_extend_plan). Past its end date, a paid plan
// keeps working for GRACE_DAYS, then the shop is read-only (terms of use,
// article 8) until it pays or its owner goes back to Standard.
//
// The database applies the same rules (supabase: plan_allows, plan_item_limit,
// plan_account_limit, shop_plan_state): keep both in step.

export const PLANS = ["STANDARD", "ESSENTIEL", "PRO", "PRO_PLUS"] as const;
export type Plan = (typeof PLANS)[number];

export const PAID_PLANS = ["ESSENTIEL", "PRO", "PRO_PLUS"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const PLAN_PRICES: Record<PaidPlan, { launch: number; normal: number }> = {
  ESSENTIEL: { launch: 5000, normal: 7500 },
  PRO: { launch: 12500, normal: 17500 },
  PRO_PLUS: { launch: 25000, normal: 35000 },
};

// null: unlimited.
export const PLAN_LIMITS: Record<Plan, { accounts: number | null; items: number | null }> = {
  STANDARD: { accounts: 1, items: 100 },
  ESSENTIEL: { accounts: 2, items: 500 },
  PRO: { accounts: 5, items: 2000 },
  PRO_PLUS: { accounts: null, items: null },
};

// The lowest plan that includes each feature.
export const FEATURE_PLAN = {
  credit: "ESSENTIEL",
  invoice_pdf: "ESSENTIEL",
  reminders: "ESSENTIEL",
  storefront: "PRO",
  purchase_orders: "PRO",
  loyalty: "PRO",
  page_access: "PRO",
  auto_reminders: "PRO",
  shipments: "PRO_PLUS",
  no_branding: "PRO_PLUS",
} as const satisfies Record<string, Plan>;
export type PlanFeature = keyof typeof FEATURE_PLAN;

export const PAYMENT_METHODS = ["MUNI_DINERO", "BANK_TRANSFER", "CASH", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MAX_MONTHS = 36;
export const GRACE_DAYS = 3;
const ENDING_SOON_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type SubscriptionState = { plan: Plan; paid_until: string | null };

export function isPaidPlan(value: string): value is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(value);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function planRank(plan: Plan): number {
  return PLANS.indexOf(plan);
}

export function planAllows(plan: Plan, feature: PlanFeature): boolean {
  return planRank(plan) >= planRank(FEATURE_PLAN[feature]);
}

// Where the shop stands today:
// - active: Standard, or a paid plan running normally;
// - ending_soon: a paid plan ending within a week;
// - grace: the end date has passed, everything still works for GRACE_DAYS;
// - read_only: after that, until it pays or goes back to Standard.
export type ShopAccess = {
  plan: Plan;
  mode: "active" | "ending_soon" | "grace" | "read_only";
  paidUntil: string | null;
  readOnlySince: string | null;
};

export function shopAccess(subscription: SubscriptionState | null, now: Date): ShopAccess {
  const plan = subscription?.plan ?? "STANDARD";
  if (plan === "STANDARD" || !subscription) return { plan: "STANDARD", mode: "active", paidUntil: null, readOnlySince: null };
  if (!subscription.paid_until) return { plan, mode: "read_only", paidUntil: null, readOnlySince: null };

  const end = new Date(subscription.paid_until).getTime();
  const readOnlySince = new Date(end + GRACE_DAYS * DAY).toISOString();
  const base = { plan, paidUntil: subscription.paid_until, readOnlySince };
  if (now.getTime() >= end + GRACE_DAYS * DAY) return { ...base, mode: "read_only" };
  if (now.getTime() >= end) return { ...base, mode: "grace" };
  if (end - now.getTime() <= ENDING_SOON_DAYS * DAY) return { ...base, mode: "ending_soon" };
  return { ...base, mode: "active" };
}

// Accounts beyond the plan's limit are paused. The owner (first manager)
// never is; the other active accounts keep access from the oldest on.
export function pausedMemberIds(
  members: { id: string; role: string; is_active: boolean; created_at: string }[],
  plan: Plan,
): Set<string> {
  const limit = PLAN_LIMITS[plan].accounts;
  if (limit === null) return new Set();
  const byAge = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const owner = byAge.find((m) => m.role === "MANAGER");
  const others = byAge.filter((m) => m.is_active && m.id !== owner?.id);
  return new Set(others.slice(Math.max(limit - 1, 0)).map((m) => m.id));
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

// Pure client statistics (AGENTS.md: every calculation is tested).

export type ClientInvoice = {
  total_amount: number;
  paid_amount: number;
  created_at: string;
};

export type ClientStats = {
  total_purchases: number;
  recent_purchases: number;
  total_spent: number;
  total_debt: number;
  first_purchase_date: string | null;
};

// A client is "fidèle" (loyal) with at least 3 purchases over the last 90
// days: the shop owner's rule (23/09/2026), replacing a first version that
// also counted any client whose single purchase was over 3 months old.
export const LOYALTY_MIN_PURCHASES = 3;
export const LOYALTY_WINDOW_DAYS = 90;

export function computeClientStats(invoices: ClientInvoice[], now: Date = new Date()): ClientStats {
  const windowStart = now.getTime() - LOYALTY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const dates = invoices.map((inv) => inv.created_at).filter(Boolean).sort();
  return {
    total_purchases: invoices.length,
    recent_purchases: invoices.filter((inv) => new Date(inv.created_at).getTime() >= windowStart).length,
    total_spent: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    // A balance can never be negative: an overpaid invoice (before the
    // 23/09/2026 fix, change given back was recorded as paid) owes nothing.
    total_debt: invoices.reduce((sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount), 0),
    first_purchase_date: dates[0] ?? null,
  };
}

export function isLoyalClient(stats: ClientStats): boolean {
  return stats.recent_purchases >= LOYALTY_MIN_PURCHASES;
}

// Canonical list of gate-able pages in the authenticated app, used both to
// enforce per-employee access (middleware, Sidebar) and to build the
// checkbox list a manager sees when configuring an employee's access.
// Kept edge-runtime-safe (no Node-only APIs) since middleware.ts imports it.

export const APP_PAGE_KEYS = [
  "dashboard",
  "stock",
  "shipments",
  "purchase_orders",
  "sales",
  "invoices",
  "clients",
  "reminders",
  "online_orders",
  "settings",
] as const;

export type AppPageKey = (typeof APP_PAGE_KEYS)[number];

export const APP_PAGES: { key: AppPageKey; path: string }[] = [
  { key: "dashboard", path: "/dashboard" },
  { key: "stock", path: "/stock" },
  { key: "shipments", path: "/shipments" },
  { key: "purchase_orders", path: "/purchase-orders" },
  { key: "sales", path: "/sales" },
  { key: "invoices", path: "/invoices" },
  { key: "clients", path: "/clients" },
  { key: "reminders", path: "/reminders" },
  { key: "online_orders", path: "/online-orders" },
  { key: "settings", path: "/settings" },
];

// Pre-checked default when a manager picks the "Caissier" role while
// creating an employee — per AGENTS.md the manager can still adjust it
// before saving, this is just a sensible starting point.
export const SELLER_DEFAULT_PAGES: AppPageKey[] = ["sales", "invoices", "online_orders"];

// Matches a locale-stripped pathname (e.g. "/invoices/abc123") to a page key.
export function matchPageKey(pathWithoutLocale: string): AppPageKey | null {
  if (pathWithoutLocale === "/dashboard") return "dashboard";
  const match = APP_PAGES.find(
    (p) => p.key !== "dashboard" && (pathWithoutLocale === p.path || pathWithoutLocale.startsWith(p.path + "/"))
  );
  return match ? match.key : null;
}

// An empty allowed_pages array means "unrestricted" — this is the default
// for every existing account (including all SELLERs before this feature
// existed), so introducing it never silently locks anyone out. Restriction
// only applies once a manager explicitly configures a non-empty page set.
export function isPageAllowed(role: string, allowedPages: string[], pathWithoutLocale: string): boolean {
  if (role === "MANAGER") return true;
  if (!allowedPages || allowedPages.length === 0) return true;
  const key = matchPageKey(pathWithoutLocale);
  if (!key) return true;
  return allowedPages.includes(key);
}

export function firstAllowedPath(allowedPages: string[]): string {
  const first = APP_PAGES.find((p) => allowedPages.includes(p.key));
  return first ? first.path : "/dashboard";
}

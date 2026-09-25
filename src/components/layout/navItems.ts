import { Package, ShoppingCart, Users, MessageCircle, LayoutDashboard, Store, FileText, Truck, ClipboardList } from "lucide-react";
import type { AppPageKey } from "@/lib/appPages";
import type { PlanFeature } from "@/features/billing/plans";

export type NavItem = {
  key: AppPageKey;
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** The plan feature this page needs: shown with a padlock below that plan. */
  feature?: PlanFeature;
};

// Shared between the desktop Sidebar and the mobile top/bottom bars so the
// nav list (and its icons) only exists in one place.
export function buildNavItems(t: (key: string) => string): NavItem[] {
  return [
    { key: "dashboard", path: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { key: "stock", path: "/stock", label: t("stock"), icon: Package },
    { key: "shipments", path: "/shipments", label: t("shipments"), icon: Truck, feature: "shipments" },
    { key: "purchase_orders", path: "/purchase-orders", label: t("purchase_orders"), icon: ClipboardList, feature: "purchase_orders" },
    { key: "sales", path: "/sales", label: t("sales"), icon: ShoppingCart },
    { key: "invoices", path: "/invoices", label: t("invoices"), icon: FileText },
    { key: "clients", path: "/clients", label: t("clients"), icon: Users },
    { key: "reminders", path: "/reminders", label: t("reminders"), icon: MessageCircle, feature: "reminders" },
    { key: "online_orders", path: "/online-orders", label: t("online_orders"), icon: Store, feature: "storefront" },
  ];
}

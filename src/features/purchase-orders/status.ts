import type { PurchaseOrderStatus } from "./queries";

// Badge colours per purchase-order status, shared by client and server screens.
export const PURCHASE_ORDER_STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
  SENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-500 line-through dark:bg-white/5 dark:text-zinc-500",
};

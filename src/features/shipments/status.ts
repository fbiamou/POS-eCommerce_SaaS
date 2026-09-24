import type { ShipmentStatus } from "./queries";

// Badge colours per shipment status, shared by the list (client) and the
// detail page (server).
export const SHIPMENT_STATUS_STYLES: Record<ShipmentStatus, string> = {
  AWAITING_DECLARATION: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
  IN_TRANSIT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-500 line-through dark:bg-white/5 dark:text-zinc-500",
};

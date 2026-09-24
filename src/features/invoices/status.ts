// Colours of the invoice status pills, shared by the list and the invoice
// page. Green means paid and red means nothing paid yet (status colours only,
// never brand colours); a partial payment is amber.
export const INVOICE_STATUS_CLASS = {
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const;

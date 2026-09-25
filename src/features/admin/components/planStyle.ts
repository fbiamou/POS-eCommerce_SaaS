import type { Plan } from "@/features/billing/plans";

// Plan badges in the console: Standard stays grey, paid plans climb the
// indigo scale, Pro Plus on indigo night with a saffron label.
export const PLAN_BADGE_CLASS: Record<Plan, string> = {
  STANDARD: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  ESSENTIEL: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  PRO: "bg-violet-600 text-white",
  PRO_PLUS: "bg-night text-saffron dark:bg-violet-950",
};

// A country's name in the reader's language ("GQ" → "Guinée équatoriale").
export function countryName(code: string | null, locale: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

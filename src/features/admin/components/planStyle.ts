import type { Plan } from "@/features/billing/plans";

// Plan badges in the console: Standard stays grey, paid plans climb the
// indigo scale, Pro Plus on indigo night with a saffron label.
export const PLAN_BADGE_CLASS: Record<Plan, string> = {
  STANDARD: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  ESSENTIEL: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  PRO: "bg-violet-600 text-white",
  PRO_PLUS: "bg-night text-saffron dark:bg-violet-950",
};

// Where a paid plan stands, when it is not simply running.
export const ACCESS_BADGE_CLASS: Record<"ending_soon" | "grace" | "read_only", string> = {
  ending_soon: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  grace: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  read_only: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

// The language to write to a shop in: the one chosen at sign-up, or, for
// shops that signed up before it was recorded, the one of its country
// (Spanish in Equatorial Guinea, French elsewhere in the CEMAC zone).
export function shopLanguage(locale: string | null, countryCode: string | null): { code: "es" | "fr" | "en"; fromSignup: boolean } | null {
  if (locale === "es" || locale === "fr" || locale === "en") return { code: locale, fromSignup: true };
  if (!countryCode) return null;
  return { code: countryCode === "GQ" ? "es" : "fr", fromSignup: false };
}

// A country's name in the reader's language ("GQ" → "Guinée équatoriale").
export function countryName(code: string | null, locale: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

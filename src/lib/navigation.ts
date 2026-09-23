import "server-only";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import type { FeedbackCode } from "@/lib/feedback";

type FeedbackQuery = {
  tab?: string;
  error?: FeedbackCode;
  message?: FeedbackCode;
  [key: string]: string | undefined;
};

// Redirects to an app page in the visitor's current language. Server actions
// used to hardcode "/fr/...", which threw Spanish and English users back into
// French after every form submission.
export async function redirectLocalized(pathname: string, query?: FeedbackQuery): Promise<never> {
  const locale = await getLocale();
  const cleanQuery = query
    ? Object.fromEntries(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])))
    : undefined;
  return redirect({ href: cleanQuery ? { pathname, query: cleanQuery } : pathname, locale });
}

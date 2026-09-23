// Single source of truth for every amount and date shown to a user.
//
// Amounts are stored as integers in the shop's currency unit (AGENTS.md), so
// they are always displayed without decimals. The currency symbol comes from
// the shop's settings, never from a hardcoded "FCFA", and the digit grouping
// follows the interface language (84 500 in French, 84.500 in Spanish,
// 84,500 in English).
//
// Every space placed inside a formatted value is non-breaking, so an amount
// can never be split across two lines ("84 | 500 FCFA").

const NBSP = " ";

export const DEFAULT_TIME_ZONE = "Africa/Douala";

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    // Spanish only groups from five digits by default ("7900" but "84.500");
    // grouping always keeps a price list aligned and readable.
    useGrouping: "always",
  }).format(value);
}

export function formatMoney(value: number, currencySymbol: string, locale: string): string {
  const amount = formatNumber(value, locale);
  return currencySymbol ? `${amount}${NBSP}${currencySymbol}` : amount;
}

type DateStyle = "short" | "long" | "dateTime" | "weekday";

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  dateTime: { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
};

export function formatDate(
  value: string | Date,
  locale: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  style: DateStyle = "short"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTIONS[style], timeZone }).format(date);
}

// Minutes to add to UTC to get the wall-clock time in `timeZone` at `date`.
function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((wallClockAsUtc - date.getTime()) / 60000);
}

// The [start, end) instants of the calendar day containing `date`, as lived
// in the shop's time zone. The server runs in UTC: without this, a sale made
// at 00:30 in Douala (23:30 UTC) would count for the previous day.
export function dayRangeInTimeZone(date: Date, timeZone: string = DEFAULT_TIME_ZONE): { start: Date; end: Date } {
  const offset = timeZoneOffsetMinutes(date, timeZone);
  const local = new Date(date.getTime() + offset * 60000);
  const localMidnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(localMidnightAsUtc - timeZoneOffsetMinutes(new Date(localMidnightAsUtc), timeZone) * 60000);
  const nextLocalMidnightAsUtc = localMidnightAsUtc + 24 * 60 * 60000;
  const end = new Date(nextLocalMidnightAsUtc - timeZoneOffsetMinutes(new Date(nextLocalMidnightAsUtc), timeZone) * 60000);
  return { start, end };
}

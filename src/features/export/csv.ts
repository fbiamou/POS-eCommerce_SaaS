// CSV for the full data export, meant to be opened in Excel by the shop:
// semicolon-separated (what French and Spanish Excel expect), with a UTF-8
// byte order mark so accents display correctly.

export type CsvValue = string | number | boolean | null | undefined;

// A cell beginning with "=", "@" or a sign could run as a formula once opened
// in a spreadsheet. Some texts come from outside the shop (a storefront
// customer's name), so they are neutralised; numbers and phone numbers stay
// as they are.
function neutraliseFormula(text: string): string {
  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !/^[+-][\d\s().]*$/.test(text)) return `'${text}`;
  return text;
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? neutraliseFormula(value) : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toExportCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(";"));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// "2026-09-25 14:03" in the shop's time zone: sortable, and recognised as a
// date by spreadsheets.
export function exportDate(value: string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

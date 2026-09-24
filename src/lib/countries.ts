// Countries a shop can pick in its settings: the CEMAC zone, Equatorial
// Guinea first (priority market). Choosing one pre-fills the dialling code,
// the time zone and the standard VAT rate, and names the tax identifier
// printed on receipts and invoices. Every value stays editable.
//
// VAT rates (basis points) from the legal note of 24/09/2026 (Cadre légal
// WISHOP): Equatorial Guinea 15 %, Cameroon 19.25 % (17.5 % + 10 % communal
// surcharge), Gabon 18 %, Congo 18.9 % (18 % + 5 % surcharge), Chad 18 %,
// Central African Republic 19 % (to be confirmed).
export const SHOP_COUNTRIES = [
  { code: "GQ", phone: "+240", timeZone: "Africa/Malabo", vatBps: 1500, taxIdLabel: "NIF" },
  { code: "CM", phone: "+237", timeZone: "Africa/Douala", vatBps: 1925, taxIdLabel: "NIU" },
  { code: "GA", phone: "+241", timeZone: "Africa/Libreville", vatBps: 1800, taxIdLabel: "NIF" },
  { code: "CG", phone: "+242", timeZone: "Africa/Brazzaville", vatBps: 1890, taxIdLabel: "NIU" },
  { code: "TD", phone: "+235", timeZone: "Africa/Ndjamena", vatBps: 1800, taxIdLabel: "NIF" },
  { code: "CF", phone: "+236", timeZone: "Africa/Bangui", vatBps: 1900, taxIdLabel: "NIF" },
] as const;

export type ShopCountryCode = (typeof SHOP_COUNTRIES)[number]["code"];

export function findShopCountry(code: string | null | undefined) {
  return SHOP_COUNTRIES.find((c) => c.code === code) ?? null;
}

// "NIU" in Cameroon and Congo, "NIF" elsewhere in the zone; null when the
// shop has not chosen a country, so callers fall back to a generic label.
export function taxIdLabelFor(code: string | null | undefined): string | null {
  return findShopCountry(code)?.taxIdLabel ?? null;
}

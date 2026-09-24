// Curated dial-code list, CEMAC/Central Africa first since that's this
// platform's primary market, then other commonly relevant countries.
// `abbr` is the ISO 3166-1 alpha-2 code, used for a compact display once
// a country is selected (the full `label` is shown while the list is open).
export const PHONE_COUNTRY_CODES = [
  { code: "+237", label: "Cameroun", abbr: "CM" },
  { code: "+240", label: "Guinée Équatoriale", abbr: "GQ" },
  { code: "+241", label: "Gabon", abbr: "GA" },
  { code: "+242", label: "Congo", abbr: "CG" },
  { code: "+243", label: "RD Congo", abbr: "CD" },
  { code: "+235", label: "Tchad", abbr: "TD" },
  { code: "+236", label: "Centrafrique", abbr: "CF" },
  { code: "+225", label: "Côte d'Ivoire", abbr: "CI" },
  { code: "+221", label: "Sénégal", abbr: "SN" },
  { code: "+223", label: "Mali", abbr: "ML" },
  { code: "+226", label: "Burkina Faso", abbr: "BF" },
  { code: "+229", label: "Bénin", abbr: "BJ" },
  { code: "+228", label: "Togo", abbr: "TG" },
  { code: "+227", label: "Niger", abbr: "NE" },
  { code: "+224", label: "Guinée", abbr: "GN" },
  { code: "+234", label: "Nigéria", abbr: "NG" },
  { code: "+233", label: "Ghana", abbr: "GH" },
  { code: "+212", label: "Maroc", abbr: "MA" },
  { code: "+213", label: "Algérie", abbr: "DZ" },
  { code: "+216", label: "Tunisie", abbr: "TN" },
  { code: "+33", label: "France", abbr: "FR" },
  { code: "+32", label: "Belgique", abbr: "BE" },
  { code: "+41", label: "Suisse", abbr: "CH" },
  { code: "+1", label: "USA / Canada", abbr: "US" },
  // Usual sourcing countries for wigs, cosmetics and clothing (suppliers
  // and shipment intermediaries).
  { code: "+971", label: "Émirats arabes unis", abbr: "AE" },
  { code: "+86", label: "Chine", abbr: "CN" },
  { code: "+90", label: "Turquie", abbr: "TR" },
] as const;

export const DEFAULT_PHONE_COUNTRY_CODE = "+237";

// Splits a stored phone ("+971501234567") into its dial code and digits. A
// number stored without a known dial code falls back to `fallbackCode`
// rather than guessing wrong. Longest codes are tried first so "+1" never
// swallows a longer code starting with the same digit.
export function splitPhone(phone: string | null | undefined, fallbackCode: string): { code: string; digits: string } {
  if (!phone) return { code: fallbackCode, digits: "" };
  const match = [...PHONE_COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => phone.startsWith(c.code));
  if (match) return { code: match.code, digits: phone.slice(match.code.length) };
  return { code: fallbackCode, digits: phone.replace(/\D/g, "") };
}

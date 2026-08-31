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
] as const;

export const DEFAULT_PHONE_COUNTRY_CODE = "+237";

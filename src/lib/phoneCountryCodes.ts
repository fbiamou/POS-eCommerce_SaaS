// Curated dial-code list, CEMAC/Central Africa first since that's this
// platform's primary market, then other commonly relevant countries.
export const PHONE_COUNTRY_CODES = [
  { code: "+237", label: "Cameroun" },
  { code: "+240", label: "Guinée Équatoriale" },
  { code: "+241", label: "Gabon" },
  { code: "+242", label: "Congo" },
  { code: "+243", label: "RD Congo" },
  { code: "+235", label: "Tchad" },
  { code: "+236", label: "Centrafrique" },
  { code: "+225", label: "Côte d'Ivoire" },
  { code: "+221", label: "Sénégal" },
  { code: "+223", label: "Mali" },
  { code: "+226", label: "Burkina Faso" },
  { code: "+229", label: "Bénin" },
  { code: "+228", label: "Togo" },
  { code: "+227", label: "Niger" },
  { code: "+224", label: "Guinée" },
  { code: "+234", label: "Nigéria" },
  { code: "+233", label: "Ghana" },
  { code: "+212", label: "Maroc" },
  { code: "+213", label: "Algérie" },
  { code: "+216", label: "Tunisie" },
  { code: "+33", label: "France" },
  { code: "+32", label: "Belgique" },
  { code: "+41", label: "Suisse" },
  { code: "+1", label: "USA / Canada" },
] as const;

export const DEFAULT_PHONE_COUNTRY_CODE = "+237";

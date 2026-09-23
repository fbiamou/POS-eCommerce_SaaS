// Time zones offered in the shop settings. "Today" (daily revenue, today's
// best sellers) is computed in the shop's zone, not the server's (UTC).
// Labels are city names, identical in every interface language.
export const SHOP_TIME_ZONES = [
  { value: "Africa/Douala", label: "Douala, Yaoundé (UTC+1)" },
  { value: "Africa/Malabo", label: "Malabo (UTC+1)" },
  { value: "Africa/Libreville", label: "Libreville (UTC+1)" },
  { value: "Africa/Brazzaville", label: "Brazzaville (UTC+1)" },
  { value: "Africa/Kinshasa", label: "Kinshasa (UTC+1)" },
  { value: "Africa/Ndjamena", label: "N'Djamena (UTC+1)" },
  { value: "Africa/Bangui", label: "Bangui (UTC+1)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
  { value: "Africa/Abidjan", label: "Abidjan, Dakar, Bamako, Lomé (UTC+0)" },
  { value: "Africa/Accra", label: "Accra (UTC+0)" },
  { value: "Africa/Casablanca", label: "Casablanca (UTC+1)" },
  { value: "Europe/Paris", label: "Paris, Bruxelles (UTC+1/+2)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/+2)" },
  { value: "America/Montreal", label: "Montréal (UTC-5/-4)" },
] as const;

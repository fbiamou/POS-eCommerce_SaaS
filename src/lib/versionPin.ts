// A device stays on the version of WISHOP it loaded until its user presses
// "Mettre à jour", or until the app updates itself at night while nobody
// uses it (decided 26/09/2026, features/offline/updatePolicy.ts).
//
// On Vercel this is the __vdpl cookie of Skew Protection, a paid-plan
// feature: every request carrying it, pages included, goes to that version.
// Without Skew Protection (free plan) nothing here applies and a new version
// reaches devices at their next page load, as before.
//
// Setting to make in the Vercel project (Settings › Advanced › Skew
// Protection): enabled, with a Maximum Age of at least PIN_WINDOW_DAYS + 1
// days. Past that age Vercel answers 404 to a device still on the old
// version, so the cookie never outlives the window.

export const PIN_COOKIE = "__vdpl";
export const PIN_WINDOW_DAYS = 29;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How long, in seconds, a device may still stay on a version built at
 * buildTime (ms). 0 when too little is left: the device then moves on to the
 * latest version at its next page load.
 */
export function pinSeconds(buildTime: number, now: number): number {
  if (!Number.isFinite(buildTime) || buildTime <= 0) return 0;
  const left = buildTime + PIN_WINDOW_DAYS * DAY_MS - now;
  return left > HOUR_MS ? Math.floor(left / 1000) : 0;
}

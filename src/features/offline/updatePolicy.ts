// When a new version of WISHOP is out, it only reaches a device when its
// user presses "Mettre à jour" (decided 26/09/2026). If nobody ever does,
// the app updates itself at night, from midnight (device time), provided
// nobody has used it since then; a night with activity moves it to the next
// one. A device switched off at night updates when it is opened again, as
// long as nobody has touched it yet. The banner announces the date and time.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight starting the night after `seenAt`, or the current night when seen before 3 a.m. */
export function firstNight(seenAt: Date): Date {
  const night = new Date(seenAt);
  if (night.getHours() >= 3) night.setDate(night.getDate() + 1);
  night.setHours(0, 0, 0, 0);
  return night;
}

/**
 * The automatic update time: the first night after the version was seen
 * during which nobody used the app since midnight.
 */
export function autoUpdateAt(seenAt: Date, lastActivity: number): Date {
  let night = firstNight(seenAt).getTime();
  while (lastActivity >= night) night += DAY_MS;
  // Days are not always 24 hours long (clock changes): back to midnight.
  const date = new Date(night);
  if (date.getHours() !== 0) date.setHours(date.getHours() < 12 ? 0 : 24, 0, 0, 0);
  return date;
}

/** True when the app may update itself now. */
export function autoUpdateDue(now: number, seenAt: Date, lastActivity: number): boolean {
  return now >= autoUpdateAt(seenAt, lastActivity).getTime();
}

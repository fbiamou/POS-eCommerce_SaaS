import { describe, expect, it } from "vitest";
import { autoUpdateAt, autoUpdateDue, firstNight } from "./updatePolicy";
import { pinSeconds, PIN_WINDOW_DAYS } from "@/lib/versionPin";

// Device time (local), as the shop sees it.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

describe("automatic update at night", () => {
  it("is planned for the midnight after the new version was seen", () => {
    expect(firstNight(at(26, 14, 30))).toEqual(at(27, 0));
    expect(firstNight(at(26, 1, 15))).toEqual(at(26, 0));
  });

  it("happens at midnight when nobody used the app since then", () => {
    const seen = at(26, 14);
    const lastUse = at(26, 21).getTime();
    expect(autoUpdateAt(seen, lastUse)).toEqual(at(27, 0));
    expect(autoUpdateDue(at(26, 23, 59).getTime(), seen, lastUse)).toBe(false);
    expect(autoUpdateDue(at(27, 0, 1).getTime(), seen, lastUse)).toBe(true);
  });

  it("waits for the next night when someone works after midnight", () => {
    const seen = at(26, 14);
    const lastUse = at(27, 1, 30).getTime();
    expect(autoUpdateAt(seen, lastUse)).toEqual(at(28, 0));
    expect(autoUpdateDue(at(27, 2).getTime(), seen, lastUse)).toBe(false);
  });

  it("happens at the next opening when the device was off all night, before anyone touches it", () => {
    const seen = at(26, 14);
    expect(autoUpdateDue(at(27, 8).getTime(), seen, at(26, 19).getTime())).toBe(true);
    // Somebody already started working this morning: the next night instead.
    expect(autoUpdateDue(at(27, 8, 5).getTime(), seen, at(27, 8, 1).getTime())).toBe(false);
  });
});

describe("device kept on its version (Vercel)", () => {
  it("lasts until the end of the window, and not when too little is left", () => {
    const built = at(1, 10).getTime();
    expect(pinSeconds(built, built)).toBe(PIN_WINDOW_DAYS * 24 * 3600);
    expect(pinSeconds(built, built + PIN_WINDOW_DAYS * 24 * 3600 * 1000 - 30 * 60 * 1000)).toBe(0);
    expect(pinSeconds(Number.NaN, built)).toBe(0);
  });
});

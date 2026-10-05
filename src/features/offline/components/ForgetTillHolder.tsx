"use client";

import { useEffect } from "react";

// On the sign-in page nobody is signed in: the colleague who held the till on
// this device is forgotten, so the account that signs in next starts as
// itself. Signing out already does this, but the page signing out could
// still write the holder back an instant before leaving (it follows the
// server, which had not yet forgotten her), and the same account signing in
// again found the till in her name.
export function ForgetTillHolder() {
  useEffect(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("wishop-cashier-") && !k.startsWith("wishop-cashier-day-")) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
      document.documentElement.removeAttribute("data-till");
    } catch {
      // Storage blocked: nothing kept on the device either.
    }
  }, []);
  return null;
}

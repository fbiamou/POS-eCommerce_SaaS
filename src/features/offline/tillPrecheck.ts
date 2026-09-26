import { APP_PAGES, MANAGER_ONLY_PAGES } from "@/lib/appPages";

// A colleague holding the till (till code) who opens a page closed to her is
// sent to the till before anything of that page is drawn, online and offline
// (decided 26/09/2026). This runs as an inline script at the top of the app
// layout, before React: it reads the holder and her rights kept on the
// device (pin.ts, writeTillRights) and applies the same rules as
// isPageAllowed and firstOpenPath (lib/appPages.ts), written in plain browser
// JavaScript. tillPrecheck.test.ts checks both agree.
const PRECHECK = `(function (shop, user, pages, managerOnly) {
  try {
    var raw = localStorage.getItem("wishop-cashier-" + shop);
    if (!raw) return;
    var holder = JSON.parse(raw);
    if (!holder || holder.sessionUserId !== user || holder.id === user || typeof holder.role !== "string") return;
    var locale = (location.pathname.match(/^\\/(es|fr|en)(\\/|$)/) || [])[1];
    if (!locale) return;
    var path = location.pathname.replace(/^\\/(es|fr|en)/, "") || "/";
    var allowed = holder.allowed_pages || [];
    var keyOf = function (p) {
      if (p === "/dashboard") return "dashboard";
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].key !== "dashboard" && (p === pages[i].path || p.indexOf(pages[i].path + "/") === 0)) return pages[i].key;
      }
      return null;
    };
    var open = function (p) {
      if (holder.role === "MANAGER") return true;
      var key = keyOf(p);
      if (key && managerOnly.indexOf(key) >= 0) return false;
      if (!allowed.length || !key) return true;
      return allowed.indexOf(key) >= 0;
    };
    if (path.indexOf("/admin") !== 0 && open(path)) return;
    var home = null;
    if (holder.role === "MANAGER") home = "/dashboard";
    else if (open("/sales")) home = "/sales";
    else for (var j = 0; j < pages.length && !home; j++) if (open(pages[j].path)) home = pages[j].path;
    if (!home || home === path) return;
    document.documentElement.style.visibility = "hidden";
    location.replace("/" + locale + home);
  } catch (e) {}
})`;

/** The inline script for this shop and this signed-in account. */
export function tillPrecheckScript(shopId: string, sessionUserId: string): string {
  const pages = APP_PAGES.map(({ key, path }) => ({ key, path }));
  return `${PRECHECK}(${JSON.stringify(shopId)}, ${JSON.stringify(sessionUserId)}, ${JSON.stringify(pages)}, ${JSON.stringify(MANAGER_ONLY_PAGES)});`;
}

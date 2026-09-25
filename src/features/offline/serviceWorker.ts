// Installs WISHOP's service worker (public/sw.js), which keeps the app's
// pages so they open without internet, on a phone as on a computer.

const SW_URL = "/sw.js";
const PAGES_CACHE_PREFIX = "wishop-pages-";

/** Same id as SHELL_ID in public/sw.js: the kept copy of a detail page. */
export const SHELL_ID = "00000000-0000-0000-0000-000000000000";

function supported() {
  // Not in development: a kept copy of the pages would hide code changes.
  return process.env.NODE_ENV === "production" && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function registerServiceWorker() {
  if (!supported()) return;
  navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    // Private browsing or an old browser: the app still works online.
  });
}

async function activeWorker(): Promise<ServiceWorker | null> {
  if (!supported()) return null;
  const ready = navigator.serviceWorker.ready.then((registration) => registration.active);
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
  return Promise.race([ready, late]);
}

/** Keeps the main pages right away, once per session, while online. */
export async function warmOfflinePages(locale: string) {
  try {
    if (sessionStorage.getItem("wishop-pages-warmed") === locale) return;
    const worker = await activeWorker();
    if (!worker) return;
    const pages = ["dashboard", "sales", "stock", "clients", "invoices", `invoices/${SHELL_ID}`, `invoices/${SHELL_ID}/ticket`];
    worker.postMessage({ type: "warm", urls: pages.map((page) => `/${locale}/${page}`) });
    sessionStorage.setItem("wishop-pages-warmed", locale);
  } catch {
    // Storage blocked: the pages will be kept as they are visited.
  }
}

/** On logout: the kept pages show the shop's data, they leave with the user. */
export async function clearOfflinePages() {
  try {
    sessionStorage.removeItem("wishop-pages-warmed");
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PAGES_CACHE_PREFIX)).map((name) => caches.delete(name)));
  } catch {
    // No Cache API (old browser): nothing was kept.
  }
}

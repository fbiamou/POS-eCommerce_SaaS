// WISHOP service worker: lets the app open without internet.
//
// - App pages (/es/sales, /fr/invoices/...): network first. Each page seen
//   online is kept; without internet the kept copy is shown, and the page
//   then reads the device's own data (IndexedDB, see src/features/offline).
// - Build files (/_next/static/...): kept once, they never change.
// - Everything else (Supabase, the storefront, the landing page) is left
//   alone: the service worker never answers for it.
//
// The pages are kept per user: logging out empties them (message "clear").
// They are also kept per version of the app: the page registers this file
// with its version (sw.js?v=...), so a new version replaces the old copies
// instead of serving yesterday's code offline.

const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";
const PAGES = `wishop-pages-${VERSION}`;
const ASSETS = `wishop-assets-${VERSION}`;

// Pages of the signed-in app. The storefront (/boutique) and the landing
// page are public and do not need to work offline.
const APP_PATH = /^\/(es|fr|en)\/(dashboard|sales|stock|clients|invoices|reminders|purchase-orders|shipments|online-orders|settings|locked)(\/|$)/;

// Detail pages open on any id, even a sale made offline a minute ago: the
// kept copy of one detail page serves them all, the page reads its id from
// the address and its data from the device.
const SHELL_ID = "00000000-0000-0000-0000-000000000000";
const DETAIL_PATH = /^\/(es|fr|en)\/(invoices|clients)\/[^/]+(\/ticket)?\/?$/;

// A page that takes longer than this to answer is shown from the device;
// the network answer still refreshes the kept copy for next time.
const NETWORK_WAIT_MS = 6000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const older = names.filter((name) => name.startsWith("wishop-") && name !== PAGES && name !== ASSETS);
      // Fonts and images keep their name from one version to the next: they
      // move to the new version instead of being lost with the old one.
      const assets = await caches.open(ASSETS);
      for (const name of older.filter((n) => n.startsWith("wishop-assets-"))) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (!new URL(request.url).pathname.includes("/media/") || (await assets.match(request))) continue;
          const response = await cache.match(request);
          if (response) await assets.put(request, response);
        }
      }
      await Promise.all(older.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

function pageKey(url) {
  return url.origin + url.pathname.replace(/\/$/, "");
}

function shellKey(url) {
  const match = url.pathname.match(DETAIL_PATH);
  if (!match) return null;
  return `${url.origin}/${match[1]}/${match[2]}/${SHELL_ID}${match[3] || ""}`;
}

function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

// A page that ended on the login form (session expired) is not kept: it
// would later show the login form instead of the page.
function keepable(response) {
  return response && response.ok && !response.redirected && response.type === "basic";
}

async function keepPage(key, response) {
  if (!keepable(response)) return;
  const cache = await caches.open(PAGES);
  await cache.put(key, response);
}

function offlinePage(url) {
  const locale = (url.pathname.match(/^\/(es|fr|en)\//) || [])[1] || "es";
  const text = {
    es: ["Sin conexión", "Esta página todavía no se ha abierto en este aparato. La caja funciona sin internet:", "Abrir la caja"],
    fr: ["Hors ligne", "Cette page n'a pas encore été ouverte sur cet appareil. La caisse fonctionne sans internet :", "Ouvrir la caisse"],
    en: ["Offline", "This page has not been opened on this device yet. The till works without internet:", "Open the till"],
  }[locale];
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WISHOP · ${text[0]}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F2F3F8;color:#141C45;font:16px/1.5 system-ui,sans-serif;padding:24px}main{max-width:360px;text-align:center}h1{font-size:22px;margin:0 0 8px}a{display:inline-block;margin-top:16px;background:#2B44A0;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head>
<body><main><h1>${text[0]}</h1><p>${text[1]}</p><a href="/${locale}/sales">${text[2]}</a></main></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function fromDevice(url) {
  const cache = await caches.open(PAGES);
  const options = { ignoreSearch: true, ignoreVary: true };
  const shell = shellKey(url);
  const locale = (url.pathname.match(/^\/(es|fr|en)\//) || [])[1] || "es";
  return (
    (await cache.match(pageKey(url), options)) ||
    (shell && (await cache.match(shell, options))) ||
    (await cache.match(`${url.origin}/${locale}/sales`, options)) ||
    offlinePage(url)
  );
}

async function page(event, url) {
  const network = fetch(event.request).catch(() => null);
  // Declared before any wait: the browser keeps the worker alive until the
  // copy is saved, even when the device's copy was shown first.
  event.waitUntil(network.then((response) => response && keepPage(pageKey(url), response.clone())));
  const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), NETWORK_WAIT_MS));
  const first = await Promise.race([network, slow]);
  if (first && first !== "slow") return first;
  if (first === "slow") {
    const kept = await caches.open(PAGES).then((cache) => cache.match(pageKey(url), { ignoreSearch: true, ignoreVary: true }));
    if (kept) return kept;
    const late = await network;
    if (late) return late;
  }
  return fromDevice(url);
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(asset(request));
    return;
  }
  // Page data fetched by the app while browsing: when it fails, Next.js
  // loads the whole page instead, which is answered below.
  if (isRscRequest(request, url)) return;
  if (request.mode === "navigate" && APP_PATH.test(url.pathname)) {
    event.respondWith(page(event, url));
  }
});

// Files named in a page. Next.js also names some inside its own data, where
// they are written \"/_next/static/...\": the backslash ends the name.
const STATIC_FILE = /\/_next\/static\/[^"'\s)\\]+/g;
// Files named in a style sheet: the fonts, url(../media/...).
const CSS_URL = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

async function keepFile(assets, file) {
  if (await assets.match(file)) return;
  const response = await fetch(file);
  if (response.ok) await assets.put(file, response);
}

// Keeps the main pages and their files right after sign-in, so they open
// offline even if they were never visited on this device.
async function warm(urls) {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  const styles = new Set();
  for (const path of urls) {
    try {
      const url = new URL(path, self.location.origin);
      const response = await fetch(url, { credentials: "same-origin" });
      if (!keepable(response)) continue;
      const html = await response.clone().text();
      await pages.put(pageKey(url), response);
      for (const file of new Set(html.match(STATIC_FILE) || [])) {
        if (file.endsWith(".css")) styles.add(file);
        await keepFile(assets, file);
      }
    } catch {
      // No connection: the next sign-in or visit will try again.
    }
  }
  // Without its fonts kept too, the app shows other, bigger letters offline.
  for (const style of styles) {
    try {
      const kept = await assets.match(style);
      if (!kept) continue;
      const base = new URL(style, self.location.origin);
      for (const [, ref] of (await kept.text()).matchAll(CSS_URL)) {
        if (ref.startsWith("data:")) continue;
        const file = new URL(ref, base).pathname;
        if (file.startsWith("/_next/static/")) await keepFile(assets, file);
      }
    } catch {
      // No connection: tried again at the next sign-in or new version.
    }
  }
}

async function forget(paths) {
  const cache = await caches.open(PAGES);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((request) => {
        const path = new URL(request.url).pathname;
        return paths.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
      })
      .map((request) => cache.delete(request))
  );
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(warm(data.urls));
  } else if (data.type === "clear") {
    event.waitUntil(caches.delete(PAGES));
  } else if (data.type === "forget" && Array.isArray(data.paths)) {
    // A colleague holds the till: the kept copies of the pages she may not
    // open go, so they cannot be shown offline.
    event.waitUntil(forget(data.paths));
  }
});

// The WISHOP home page (public/landing/index.html) picks its language in the
// browser, but link previews (WhatsApp, Facebook) only read the <head>. This
// script writes one copy per language — es.html, fr.html, en.html — that
// differ only by their <head> (title, description, link preview), and the
// proxy serves the right one for "/", "/es", "/fr" and "/en".
//
// Run it after every change to index.html:  node scripts/landing-locales.mjs
// (a test fails if the copies are out of date).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SITE_URL = "https://wishop-saa-s.vercel.app";

// Same wording as the page's own dictionary (DICT: _title, _desc); the
// shorter preview text follows the French one.
export const LANDING_HEADS = {
  es: {
    lang: "es",
    ogLocale: "es_ES",
    url: `${SITE_URL}/`,
    title: "WISHOP · No pierdas el hilo de tu tienda",
    description:
      "Cobra, sigue cada crédito hasta el último franco, vigila el stock y recuerda a tus clientes por WhatsApp. Todo desde tu teléfono, incluso sin internet. Gratis para empezar.",
    preview: "Ventas, stock, créditos de clientes y recordatorios por WhatsApp, desde tu teléfono, incluso sin internet. Gratis para empezar.",
  },
  fr: {
    lang: "fr",
    ogLocale: "fr_FR",
    url: `${SITE_URL}/fr`,
    title: "WISHOP · Ne perdez plus le fil de votre boutique",
    description:
      "Encaissez, suivez chaque crédit jusqu'au dernier franc, surveillez le stock et relancez vos clients sur WhatsApp. Tout depuis votre téléphone, même sans internet. Gratuit pour commencer.",
    preview: "Ventes, stock, crédits clients et relances WhatsApp, depuis votre téléphone, même sans internet. Gratuit pour commencer.",
  },
  en: {
    lang: "en",
    ogLocale: "en_US",
    url: `${SITE_URL}/en`,
    title: "WISHOP · Never lose the thread of your shop",
    description:
      "Ring up sales, track every credit down to the last franc, keep an eye on stock and remind customers on WhatsApp. All from your phone, even offline. Free to start.",
    preview: "Sales, stock, customer credit and WhatsApp reminders, from your phone, even offline. Free to start.",
  },
};

const escapeAttr = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function replaceOnce(html, pattern, replacement) {
  const matches = html.match(new RegExp(pattern.source, "g")) ?? [];
  if (matches.length !== 1) throw new Error(`landing-locales: expected one match for ${pattern}, found ${matches.length}`);
  return html.replace(pattern, replacement);
}

export function buildLocaleHtml(html, locale) {
  const head = LANDING_HEADS[locale];
  // Keep the page's own line endings (Git checks files out as CRLF on Windows).
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  let out = html;
  out = replaceOnce(out, /<html lang="[a-z]+">/, `<html lang="${head.lang}">`);
  out = replaceOnce(out, /<title>[^<]*<\/title>/, `<title>${head.title}</title>`);
  out = replaceOnce(out, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttr(head.description)}">`);
  out = replaceOnce(out, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeAttr(head.title)}">`);
  out = replaceOnce(
    out,
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escapeAttr(head.preview)}">${eol}<meta property="og:locale" content="${head.ogLocale}">`,
  );
  out = replaceOnce(out, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${head.url}">`);
  return out;
}

const landingDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "landing");

export function landingSource() {
  return readFileSync(join(landingDir, "index.html"), "utf8");
}

export function landingCopy(locale) {
  return readFileSync(join(landingDir, `${locale}.html`), "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = landingSource();
  for (const locale of Object.keys(LANDING_HEADS)) {
    writeFileSync(join(landingDir, `${locale}.html`), buildLocaleHtml(source, locale));
    console.log(`public/landing/${locale}.html`);
  }
}

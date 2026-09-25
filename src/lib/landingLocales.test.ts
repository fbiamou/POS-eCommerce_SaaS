import { describe, expect, it } from "vitest";
import { buildLocaleHtml, landingCopy, landingSource, LANDING_HEADS } from "../../scripts/landing-locales.mjs";

describe("home page copies per language", () => {
  it("are up to date with public/landing/index.html (run: node scripts/landing-locales.mjs)", () => {
    // Line endings aside: Git may store LF and check out CRLF on Windows.
    const lf = (text: string) => text.replace(/\r\n/g, "\n");
    const source = landingSource();
    for (const locale of Object.keys(LANDING_HEADS)) {
      expect(lf(landingCopy(locale)), `${locale}.html`).toBe(lf(buildLocaleHtml(source, locale)));
    }
  });

  it("give WhatsApp a Spanish preview on the Spanish copy", () => {
    const es = landingCopy("es");
    expect(es).toContain('<html lang="es">');
    expect(es).toContain('<meta property="og:title" content="WISHOP · No pierdas el hilo de tu tienda">');
    expect(es).toContain('<meta property="og:locale" content="es_ES">');
    expect(es).toContain('<meta property="og:image" content="https://wishop-saa-s.vercel.app/landing/assets/hero-ending.jpg">');
  });
});

// The terms of use and privacy policy a new shop accepts at sign-up, served
// statically from public/legal (see next.config.ts). They exist in Spanish
// and French, kept in step article by article; English visitors read the
// French version until an English one exists. Bump the version whenever the
// text changes, so each account records which version it accepted.
const TERMS_PATHS: Record<string, string> = {
  es: "/legal/condiciones",
  fr: "/legal/conditions",
  en: "/legal/conditions",
};

export function termsPathFor(locale: string): string {
  return TERMS_PATHS[locale] ?? TERMS_PATHS.fr;
}

export const TERMS_VERSION = "2026-09-24-v1";

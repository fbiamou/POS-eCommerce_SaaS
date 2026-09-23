import { describe, expect, it } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { FEEDBACK_CODES } from "./feedback";

type Messages = Record<string, Record<string, string> | string>;

function flatten(messages: Messages): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [namespace, entries] of Object.entries(messages)) {
    if (typeof entries === "string") flat[namespace] = entries;
    else for (const [key, value] of Object.entries(entries)) flat[`${namespace}.${key}`] = value;
  }
  return flat;
}

// The {placeholders} a sentence expects, ignoring ICU plural branches.
function placeholders(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/\{\s*([a-zA-Z_]+)\s*(?:,|\})/g)) names.add(match[1]);
  return [...names].sort();
}

const locales = { fr: flatten(fr as Messages), en: flatten(en as Messages), es: flatten(es as Messages) };

describe("translation files", () => {
  it("have exactly the same keys in French, English and Spanish", () => {
    const frKeys = Object.keys(locales.fr).sort();
    expect(Object.keys(locales.en).sort()).toEqual(frKeys);
    expect(Object.keys(locales.es).sort()).toEqual(frKeys);
  });

  it("use the same placeholders in every language", () => {
    const mismatches = Object.keys(locales.fr).filter((key) => {
      const expected = placeholders(locales.fr[key]).join(",");
      return placeholders(locales.en[key] ?? "").join(",") !== expected || placeholders(locales.es[key] ?? "").join(",") !== expected;
    });
    expect(mismatches).toEqual([]);
  });

  it("translate every feedback code a server action can return", () => {
    for (const locale of Object.values(locales)) {
      const missing = FEEDBACK_CODES.filter((code) => !locale[`Feedback.${code}`]);
      expect(missing).toEqual([]);
    }
  });

  it("never hardcode the FCFA currency in a sentence", () => {
    const hardcoded = Object.entries(locales).flatMap(([lang, flat]) =>
      Object.entries(flat)
        .filter(([key, value]) => /FCFA/.test(value) && !key.startsWith("Landing."))
        .map(([key]) => `${lang}:${key}`)
    );
    expect(hardcoded).toEqual([]);
  });
});

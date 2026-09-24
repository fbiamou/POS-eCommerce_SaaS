"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type ThemeToggleProps = {
  switchToLightLabel: string;
  switchToDarkLabel: string;
  /** "dark" when the toggle sits on the indigo night sidebar. */
  tone?: "light" | "dark";
};

// The theme lives on <html data-theme>, set before paint by the inline
// script in the root layout. Components subscribe to that attribute, so
// every toggle on the page stays in sync without hydration mismatches.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readIsDark = () => document.documentElement.getAttribute("data-theme") === "dark";

export function ThemeToggle({ switchToLightLabel, switchToDarkLabel, tone = "light" }: ThemeToggleProps) {
  const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing or blocked storage — the toggle still works for this page view.
    }
  };

  const label = isDark ? switchToLightLabel : switchToDarkLabel;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        tone === "dark"
          ? "text-[var(--nav-fg)] hover:bg-[var(--nav-hover)] hover:text-white"
          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

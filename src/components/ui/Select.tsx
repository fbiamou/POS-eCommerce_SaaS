"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";

export type SelectOption = {
  value: string;
  label: string;
  /** Secondary text shown after the label (e.g. a country's dialling code). */
  hint?: string;
  /** Compact text for the closed trigger, when the label is too long for it. */
  short?: string;
};

type SelectProps = {
  options: SelectOption[];
  /** Controlled value. Leave undefined and use defaultValue inside a plain form. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Submitted with the form through a hidden input, like a native select. */
  name?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Show a search field in the list. Defaults to true above 8 options. */
  searchable?: boolean;
  className?: string;
  /** Classes for the trigger button, to match the surrounding inputs. */
  triggerClassName?: string;
  /** Minimum width of the list, for narrow triggers (e.g. a dialling code). */
  panelMinWidth?: number;
};

const PANEL_MAX_HEIGHT = 300;

// Lower-case and strip accents so "equatoriale" finds "Équatoriale".
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// The app's own dropdown. The browser's native <select> list cannot be styled
// and looked foreign next to the WISHOP design (square, grey, system font), so
// every dropdown uses this instead: same trigger as the text inputs, rounded
// list with a check on the selected option, keyboard support, and a search
// field for long lists such as customers or countries.
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  placeholder,
  ariaLabel,
  disabled = false,
  searchable,
  className = "",
  triggerClassName = "",
  panelMinWidth,
}: SelectProps) {
  const t = useTranslations("Common");
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value ?? internal;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const withSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    if (!withSearch || !query.trim()) return options;
    const q = normalize(query.trim());
    return options.filter((o) => normalize(`${o.label} ${o.hint ?? ""}`).includes(q));
  }, [options, query, withSearch]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const up = below < PANEL_MAX_HEIGHT + 16 && rect.top > below;
    setPosition({ left: rect.left, top: up ? rect.top : rect.bottom, width: rect.width, up });
  }, []);

  const openPanel = () => {
    if (disabled) return;
    // Inside a modal <dialog>, the list must live in the dialog: anything in
    // <body> would sit behind the dialog's top layer.
    setPortalTarget((triggerRef.current?.closest("dialog") as HTMLElement | null) ?? document.body);
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (option: SelectOption) => {
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    close();
  };

  // Keep the list glued to its trigger while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    if (withSearch) searchRef.current?.focus();
    else listRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, withSearch]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // do not close a surrounding dialog
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (!withSearch && e.key.length === 1) {
      // Type-ahead: letters jump to the first matching option.
      const now = e.timeStamp;
      typeahead.current.text = now - typeahead.current.at > 700 ? e.key : typeahead.current.text + e.key;
      typeahead.current.at = now;
      const q = normalize(typeahead.current.text);
      const index = filtered.findIndex((o) => normalize(o.label).startsWith(q));
      if (index >= 0) setActive(index);
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openPanel();
    }
  };

  const panel =
    open && position && portalTarget
      ? createPortal(
          <div
            ref={panelRef}
            onKeyDown={onListKeyDown}
            style={{
              position: "fixed",
              left: position.left,
              width: Math.max(position.width, panelMinWidth ?? 0),
              ...(position.up ? { bottom: window.innerHeight - position.top + 6 } : { top: position.top + 6 }),
            }}
            className="z-[80] overflow-hidden rounded-xl bg-[var(--surface-1)] text-foreground shadow-[0_18px_40px_-16px_rgba(20,28,69,0.45)] ring-1 ring-[var(--line)]"
          >
            {withSearch && (
              <div className="relative border-b border-zinc-200 p-1.5 dark:border-[var(--line)]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder={t("search")}
                  aria-label={t("search")}
                  aria-controls={listId}
                  className="w-full rounded-lg bg-zinc-100 py-2 pl-9 pr-3 text-[14px] outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-violet-500 dark:bg-[var(--surface-2)]"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="overflow-y-auto p-1 outline-none"
              style={{ maxHeight: PANEL_MAX_HEIGHT - (withSearch ? 52 : 0) }}
            >
              {filtered.map((option, index) => {
                const isSelected = option.value === current;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] ${
                      index === active ? "bg-zinc-100 dark:bg-[var(--surface-2)]" : ""
                    } ${isSelected ? "font-semibold text-violet-700 dark:text-violet-300" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="shrink-0 font-mono text-[12px] text-zinc-500">{option.hint}</span>}
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-3 text-[14px] text-zinc-500">{t("no_results")}</li>}
            </ul>
          </div>,
          portalTarget
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:border-zinc-300 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[var(--line)] ${
          open ? "border-violet-500 ring-1 ring-violet-500" : ""
        } ${triggerClassName}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-zinc-400"}`}>
          {selected ? selected.short ?? selected.label : placeholder}
          {selected?.hint && !selected.short && <span className="ml-1.5 font-mono text-[12px] text-zinc-500">{selected.hint}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {panel}
    </div>
  );
}

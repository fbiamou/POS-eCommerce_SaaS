'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe, ChevronDown } from 'lucide-react'

// Language codes only: flag emojis render as letters on Windows ("FR FR"),
// and a flag names a country, not a language.
const LOCALES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

type Props = {
  /** 'pills' = boutons rangée (login page) | 'dropdown' = liste déroulante (sidebar) */
  variant?: 'pills' | 'dropdown'
  /** 'dark' = sur la barre latérale indigo nuit */
  tone?: 'light' | 'dark'
}

export function LocaleSwitcher({ variant = 'pills', tone = 'light' }: Props) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleChange = (nextLocale: string) => {
    if (!pathname) return
    // pathname starts with /fr, /en, /es. We replace it.
    const newPath = pathname.replace(new RegExp(`^/(${LOCALES.map(l => l.code).join('|')})(/|$)`), `/${nextLocale}$2`)
    router.replace(newPath)
  }

  if (variant === 'dropdown') {
    const selected = LOCALES.find(l => l.code === locale) || LOCALES[0]

    return (
      <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
        <Globe className={`h-3.5 w-3.5 flex-shrink-0 ${tone === 'dark' ? 'text-[var(--nav-fg)]' : 'text-zinc-400'}`} />
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`flex items-center gap-1 bg-transparent text-[13px] font-bold border-none cursor-pointer transition-colors ${
            tone === 'dark'
              ? 'text-[var(--nav-fg)] hover:text-white'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          {selected.label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>

        {isOpen && (
          <div className={`absolute left-0 mt-2 w-32 ${tone === 'dark' ? 'bottom-full mb-2 mt-0' : 'top-full'} rounded-xl border border-zinc-100 bg-white p-1.5 shadow-sm dark:border-[var(--line)] dark:bg-[var(--surface-1)] z-50`}>
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setIsOpen(false)
                  if (locale !== l.code) handleChange(l.code)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors ${
                  locale === l.code
                    ? "bg-violet-50 text-violet-600 dark:bg-white/10 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100/50 dark:text-zinc-300 dark:hover:bg-white/5"
                }`}
              >
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Pills variant — for login page
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Langue">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code)}
          disabled={locale === l.code}
          aria-pressed={locale === l.code}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${
            locale === l.code
              ? 'bg-violet-600 text-white border-transparent'
              : 'bg-white dark:bg-[var(--surface-1)] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 border border-zinc-200 dark:border-[var(--line)]'
          } disabled:opacity-60`}
        >
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  )
}

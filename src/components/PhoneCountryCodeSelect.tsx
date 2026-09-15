'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PHONE_COUNTRY_CODES } from '@/lib/phoneCountryCodes'

type Props = {
  value: string
  onChange: (code: string) => void
  label: string
}

export function PhoneCountryCodeSelect({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = PHONE_COUNTRY_CODES.find((c) => c.code === value) ?? PHONE_COUNTRY_CODES[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-24 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      >
        <span>{selected.code} {selected.abbr}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md border border-zinc-300 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {PHONE_COUNTRY_CODES.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === value}
                onClick={() => {
                  onChange(c.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-50 dark:hover:bg-zinc-700 ${
                  c.code === value ? 'bg-violet-50 font-medium dark:bg-zinc-700' : ''
                }`}
              >
                <span className="w-10 shrink-0 text-zinc-500 dark:text-zinc-400">{c.code}</span>
                <span>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { useTransition } from 'react'
import { Globe } from 'lucide-react'

const LOCALES = [
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
]

type Props = {
  /** 'pills' = boutons rangée (login page) | 'dropdown' = liste déroulante (sidebar) */
  variant?: 'pills' | 'dropdown'
}

export function LocaleSwitcher({ variant = 'pills' }: Props) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  if (variant === 'dropdown') {
    return (
      <div className="relative flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
        <select
          value={locale}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          aria-label="Changer de langue"
          className="bg-transparent text-xs font-medium text-zinc-500 dark:text-zinc-400 border-none outline-none cursor-pointer pr-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Pills variant — for login page
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Langue">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code)}
          disabled={isPending || locale === l.code}
          aria-pressed={locale === l.code}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            locale === l.code
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
          } disabled:opacity-60`}
        >
          <span>{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  )
}

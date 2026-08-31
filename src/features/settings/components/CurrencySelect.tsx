'use client'

import { useState } from 'react'

const CURRENCIES = [
  { code: 'XAF', symbol: 'FCFA', label: 'Franc CFA (FCFA)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'Dollar US ($)' },
  { code: 'GBP', symbol: '£', label: 'Livre Sterling (£)' },
  { code: 'GHS', symbol: 'GH₵', label: 'Cedi ghanéen (GH₵)' },
  { code: 'NGN', symbol: '₦', label: 'Naira nigérian (₦)' },
  { code: 'MAD', symbol: 'DH', label: 'Dirham marocain (DH)' },
  { code: 'XOF', symbol: 'FCFA', label: 'Franc CFA Ouest-Africain (FCFA)' },
  { code: 'CAD', symbol: 'CA$', label: 'Dollar canadien (CA$)' },
]

type Props = {
  defaultCode?: string
  defaultSymbol?: string
}

export function CurrencySelect({ defaultCode = 'XAF', defaultSymbol = 'FCFA' }: Props) {
  const [symbol, setSymbol] = useState(defaultSymbol)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const currency = CURRENCIES.find(c => c.code === e.target.value)
    if (currency) setSymbol(currency.symbol)
  }

  return (
    <>
      <select
        id="currency_code"
        name="currency_code"
        defaultValue={defaultCode}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {CURRENCIES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <input type="hidden" name="currency_symbol" value={symbol} />
    </>
  )
}

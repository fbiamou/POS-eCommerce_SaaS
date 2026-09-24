'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/Select'

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

  const handleChange = (code: string) => {
    const currency = CURRENCIES.find(c => c.code === code)
    if (currency) setSymbol(currency.symbol)
  }

  return (
    <>
      <Select
        id="currency_code"
        name="currency_code"
        defaultValue={defaultCode}
        onChange={handleChange}
        options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
      />
      <input type="hidden" name="currency_symbol" value={symbol} />
    </>
  )
}

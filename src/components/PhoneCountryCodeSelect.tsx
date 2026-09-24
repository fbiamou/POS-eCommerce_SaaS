'use client'

import { Select } from '@/components/ui/Select'
import { PHONE_COUNTRY_CODES } from '@/lib/phoneCountryCodes'

type Props = {
  value: string
  onChange: (code: string) => void
  label: string
}

// Dialling code picker next to a phone number field. Same dropdown as the
// rest of the app; the closed trigger stays compact ("+240 GQ") while the
// open list shows full country names, searchable.
export function PhoneCountryCodeSelect({ value, onChange, label }: Props) {
  return (
    <Select
      value={value}
      onChange={onChange}
      ariaLabel={label}
      className="w-28 shrink-0"
      panelMinWidth={240}
      searchable
      options={PHONE_COUNTRY_CODES.map((c) => ({ value: c.code, label: c.label, hint: c.code, short: `${c.code} ${c.abbr}` }))}
    />
  )
}

'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Upload } from 'lucide-react'
import { uploadShopLogo } from '@/features/settings/actions'
import { shrinkImage } from '@/lib/shrinkImage'

export function LogoUploadButton() {
  const t = useTranslations('Settings')
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)

  // A phone photo is resized before it is sent: sent as it is, it went past
  // the server's size limit and the page failed.
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    const small = await shrinkImage(file, 'logo')
    if (small !== file) {
      const files = new DataTransfer()
      files.items.add(small)
      input.files = files.files
    }
    formRef.current?.requestSubmit()
    setBusy(false)
  }

  return (
    <form ref={formRef} action={uploadShopLogo}>
      <label aria-busy={busy} className="aria-busy:pointer-events-none aria-busy:opacity-60 flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-400 transition-colors">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span>{t('shop_logo_upload')}</span>
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="hidden"
          onChange={pick}
        />
      </label>
    </form>
  )
}

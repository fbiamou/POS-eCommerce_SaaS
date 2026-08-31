'use client'

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { uploadShopLogo } from '@/features/settings/actions'

export function LogoUploadButton() {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={uploadShopLogo}>
      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-400 transition-colors">
        <Upload className="h-4 w-4" />
        <span>Choisir un logo (PNG, JPG, SVG)</span>
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
    </form>
  )
}

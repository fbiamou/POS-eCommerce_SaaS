'use server'

import { cookies } from 'next/headers'
import { PIN_COOKIE } from '@/lib/versionPin'

// "Mettre à jour": the device stops being kept on its version of WISHOP; the
// reload that follows brings the latest one (lib/versionPin.ts).
export async function releaseVersion() {
  ;(await cookies()).delete(PIN_COOKIE)
}

'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { CASHIER_COOKIE, CASHIER_COOKIE_OPTIONS, cashierCookieValue } from '@/lib/cashierSession'
import type { FeedbackCode } from '@/lib/feedback'

type Result = { ok?: true; error?: FeedbackCode }

// Who holds the till on this device (till code). Giving the till to someone,
// or taking it back as the signed-in account, always checks that person's
// code on the server; her rights then apply to every page and action.
export async function switchCashier(memberId: string, pin: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const { data: valid, error } = await supabase.rpc('verify_member_pin', { _member_id: memberId, _pin: pin })
  if (error) return { error: 'generic_error' }
  if (valid !== true) return { error: 'pin_wrong' }

  const store = await cookies()
  if (memberId === user.id) store.delete(CASHIER_COOKIE)
  else store.set(CASHIER_COOKIE, await cashierCookieValue(user.id, memberId), CASHIER_COOKIE_OPTIONS)
  return { ok: true }
}

// The device already checked a seller's code without internet: once online
// it tells the server, which only accepts it because it gives fewer rights
// (a seller of the same shop). Taking the till back never goes this way.
export async function restrictToCashier(memberId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }
  if (memberId === user.id) return { error: 'access_denied' }

  const { data: member } = await supabase.from('profiles').select('role, is_active').eq('id', memberId).maybeSingle()
  if (!member || !member.is_active || member.role !== 'SELLER') return { error: 'access_denied' }

  const store = await cookies()
  store.set(CASHIER_COOKIE, await cashierCookieValue(user.id, memberId), CASHIER_COOKIE_OPTIONS)
  return { ok: true }
}

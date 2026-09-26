'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { CASHIER_COOKIE, cashierFromCookie } from '@/lib/cashierSession'

export type Profile = {
  id: string
  full_name: string | null
  role: 'MANAGER' | 'SELLER'
  shop_id: string
  is_active: boolean
  allowed_pages: string[]
  created_at: string
  /** A till code is set (team page only; the code itself never leaves the database). */
  has_pin?: boolean
  /**
   * Set when a colleague holds the till on this device (till code): the
   * profile is hers, with her rights, and this is the account signed in.
   */
  session_user?: { id: string; full_name: string | null }
}

/**
 * Get the current user's profile from the database
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, shop_id, is_active, allowed_pages, created_at')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  // A colleague holds the till with her code: her rights apply (decided
  // 26/09/2026), not the account's. The signed cookie only counts for this
  // account, and only for a member of the same shop.
  const holderId = await cashierFromCookie((await cookies()).get(CASHIER_COOKIE)?.value, user.id)
  if (holderId) {
    const { data: holder } = await supabase
      .from('profiles')
      .select('id, full_name, role, shop_id, is_active, allowed_pages, created_at')
      .eq('id', holderId)
      .maybeSingle()
    if (holder && holder.shop_id === profile.shop_id && holder.is_active) {
      return { ...holder, session_user: { id: profile.id, full_name: profile.full_name } }
    }
  }

  return profile
}

/**
 * Get all profiles in the same shop (for the team management page)
 */
export async function getTeamMembers(): Promise<Profile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, shop_id, is_active, allowed_pages, created_at, pin_hash')
    .order('role', { ascending: true })

  if (error) {
    console.error('Error fetching team members:', error)
    return []
  }

  return (data || []).map(({ pin_hash, ...member }) => ({ ...member, has_pin: Boolean(pin_hash) }))
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

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

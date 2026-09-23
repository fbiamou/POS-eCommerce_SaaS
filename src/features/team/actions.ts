'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service'
import { getCurrentProfile } from '@/features/auth/actions'
import { APP_PAGE_KEYS, type AppPageKey } from '@/lib/appPages'
import { redirectLocalized } from '@/lib/navigation'
import type { FeedbackCode } from '@/lib/feedback'

type ActionResult = { success?: true; error?: FeedbackCode }

async function requireManager() {
  const currentProfile = await getCurrentProfile()
  if (!currentProfile || currentProfile.role !== 'MANAGER') {
    return null
  }
  return currentProfile
}

function generateInternalEmail(fullName: string, shopId: string) {
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'employe'
  const shortId = shopId.split('-')[0]
  return `${slug}.${shortId}@pos-local.internal`
}

function generateTempPassword() {
  // Generate extra bytes so stripping +/=/ still reliably leaves 12+ chars
  return randomBytes(16).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
}

export async function inviteEmployee(formData: FormData) {
  const currentProfile = await requireManager()
  if (!currentProfile) {
    return redirectLocalized('/settings', { tab: 'equipe', error: 'access_denied' })
  }

  const emailInput = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') === 'MANAGER' ? 'MANAGER' : 'SELLER'
  const allowedPages = (formData.getAll('allowed_pages') as string[]).filter((p) =>
    APP_PAGE_KEYS.includes(p as AppPageKey)
  )

  if (!password || !fullName) {
    return redirectLocalized('/settings', { tab: 'equipe', error: 'employee_name_password_required' })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return redirectLocalized('/settings', { tab: 'equipe', error: 'service_role_missing' })
  }

  const adminSupabase = createServiceRoleClient()

  // No real email? Generate an internal-only identifier — it's never sent
  // anywhere, it just satisfies Supabase Auth's need for a unique login
  // string. The owner communicates it directly to the employee.
  const email = emailInput || generateInternalEmail(fullName, currentProfile.shop_id)

  // app_metadata (writable only with the service role) tells the signup
  // trigger to attach this account to the owner's shop instead of creating
  // a new, empty one (migration stabilization_data).
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { invited_shop_id: currentProfile.shop_id, invited_role: role },
  })

  if (createError || !newUser.user) {
    console.error('Error creating employee:', createError)
    return redirectLocalized('/settings', { tab: 'equipe', error: 'employee_create_failed' })
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      shop_id: currentProfile.shop_id,
      role,
      full_name: fullName,
      // A MANAGER's access is never restricted, regardless of what was
      // submitted — the page-access checkboxes only apply to SELLER.
      allowed_pages: role === 'MANAGER' ? [] : allowedPages,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    console.error('Error updating profile:', profileError)
    return redirectLocalized('/settings', { tab: 'equipe', error: 'employee_profile_failed' })
  }

  if (emailInput) {
    return redirectLocalized('/settings', { tab: 'equipe', message: 'employee_added' })
  }
  return redirectLocalized('/settings', { tab: 'equipe', message: 'employee_added_with_login', login: email })
}

async function assertManagesTeammate(currentProfile: { shop_id: string; id: string }, memberId: string): Promise<ActionResult | null> {
  if (memberId === currentProfile.id) {
    return { error: 'self_action_forbidden' }
  }
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, shop_id')
    .eq('id', memberId)
    .single()
  if (!target || target.shop_id !== currentProfile.shop_id) {
    return { error: 'member_not_found' }
  }
  return null
}

export async function suspendTeamMember(memberId: string): Promise<ActionResult> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'access_denied' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const adminSupabase = createServiceRoleClient()
  const { error: banError } = await adminSupabase.auth.admin.updateUserById(memberId, {
    ban_duration: '876000h', // ~100 years — effectively indefinite until reactivated
  })
  if (banError) {
    console.error('Error suspending team member:', banError)
    return { error: 'suspend_failed' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').update({ is_active: false }).eq('id', memberId)
  if (profileError) {
    console.error('Error updating profile is_active:', profileError)
    return { error: 'status_update_failed' }
  }

  return { success: true }
}

export async function reactivateTeamMember(memberId: string): Promise<ActionResult> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'access_denied' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const adminSupabase = createServiceRoleClient()
  const { error: banError } = await adminSupabase.auth.admin.updateUserById(memberId, {
    ban_duration: 'none',
  })
  if (banError) {
    console.error('Error reactivating team member:', banError)
    return { error: 'reactivate_failed' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').update({ is_active: true }).eq('id', memberId)
  if (profileError) {
    console.error('Error updating profile is_active:', profileError)
    return { error: 'status_update_failed' }
  }

  return { success: true }
}

export async function updateTeamMemberRole(
  memberId: string,
  role: 'MANAGER' | 'SELLER'
): Promise<ActionResult> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'access_denied' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const supabase = await createClient()
  const updates: Record<string, unknown> = { role }
  // A MANAGER's access is never restricted — clear any leftover page
  // restrictions from when they were a SELLER.
  if (role === 'MANAGER') updates.allowed_pages = []
  const { error } = await supabase.from('profiles').update(updates).eq('id', memberId)
  if (error) {
    console.error('Error updating team member role:', error)
    return { error: 'role_update_failed' }
  }

  return { success: true }
}

export async function updateTeamMemberAllowedPages(
  memberId: string,
  allowedPages: string[]
): Promise<ActionResult> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'access_denied' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const sanitized = allowedPages.filter((p) => APP_PAGE_KEYS.includes(p as AppPageKey))

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ allowed_pages: sanitized }).eq('id', memberId)
  if (error) {
    console.error('Error updating team member access:', error)
    return { error: 'access_update_failed' }
  }

  return { success: true }
}

export async function resetTeamMemberPassword(
  memberId: string
): Promise<{ success?: true; newPassword?: string; error?: FeedbackCode }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'access_denied' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const newPassword = generateTempPassword()
  const adminSupabase = createServiceRoleClient()
  const { error } = await adminSupabase.auth.admin.updateUserById(memberId, { password: newPassword })
  if (error) {
    console.error('Error resetting team member password:', error)
    return { error: 'password_reset_failed' }
  }

  return { success: true, newPassword }
}

'use server'

import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service'
import { getCurrentProfile } from '@/features/auth/actions'
import { APP_PAGE_KEYS, type AppPageKey } from '@/lib/appPages'

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
  const supabase = await createClient()

  const currentProfile = await requireManager()
  if (!currentProfile) {
    redirect('/fr/settings?error=Accès refusé')
  }

  const emailInput = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'SELLER' | 'MANAGER'
  const allowedPages = (formData.getAll('allowed_pages') as string[]).filter((p) =>
    APP_PAGE_KEYS.includes(p as AppPageKey)
  )

  if (!password || !fullName) {
    redirect('/fr/settings?error=Le nom et le mot de passe sont requis')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    redirect('/fr/settings?error=La clé service_role Supabase n\'est pas configurée. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  }

  const adminSupabase = createServiceRoleClient()

  // No real email? Generate an internal-only identifier — it's never sent
  // anywhere, it just satisfies Supabase Auth's need for a unique login
  // string. The owner communicates it directly to the employee.
  const email = emailInput || generateInternalEmail(fullName, currentProfile.shop_id)

  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !newUser.user) {
    console.error('Error creating employee:', createError)
    redirect(`/fr/settings?error=Erreur: ${createError?.message}`)
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      shop_id: currentProfile.shop_id,
      role: role || 'SELLER',
      full_name: fullName,
      // A MANAGER's access is never restricted, regardless of what was
      // submitted — the page-access checkboxes only apply to SELLER.
      allowed_pages: role === 'MANAGER' ? [] : allowedPages,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    console.error('Error updating profile:', profileError)
    redirect(`/fr/settings?error=Employé créé mais erreur de profil: ${profileError.message}`)
  }

  const generatedNote = emailInput ? '' : ` Identifiant de connexion généré : ${email}`
  redirect(`/fr/settings?tab=equipe&message=${encodeURIComponent('Employé ajouté avec succès !' + generatedNote)}`)
}

async function assertManagesTeammate(currentProfile: { shop_id: string; id: string }, memberId: string) {
  if (memberId === currentProfile.id) {
    return { error: "Vous ne pouvez pas effectuer cette action sur votre propre compte." }
  }
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, shop_id')
    .eq('id', memberId)
    .single()
  if (!target || target.shop_id !== currentProfile.shop_id) {
    return { error: 'Membre introuvable.' }
  }
  return null
}

export async function suspendTeamMember(memberId: string): Promise<{ success?: true; error?: string }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'Accès refusé.' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const adminSupabase = createServiceRoleClient()
  const { error: banError } = await adminSupabase.auth.admin.updateUserById(memberId, {
    ban_duration: '876000h', // ~100 years — effectively indefinite until reactivated
  })
  if (banError) {
    console.error('Error suspending team member:', banError)
    return { error: 'Erreur lors de la suspension.' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').update({ is_active: false }).eq('id', memberId)
  if (profileError) {
    console.error('Error updating profile is_active:', profileError)
    return { error: 'Erreur lors de la mise à jour du statut.' }
  }

  return { success: true }
}

export async function reactivateTeamMember(memberId: string): Promise<{ success?: true; error?: string }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'Accès refusé.' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const adminSupabase = createServiceRoleClient()
  const { error: banError } = await adminSupabase.auth.admin.updateUserById(memberId, {
    ban_duration: 'none',
  })
  if (banError) {
    console.error('Error reactivating team member:', banError)
    return { error: 'Erreur lors de la réactivation.' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').update({ is_active: true }).eq('id', memberId)
  if (profileError) {
    console.error('Error updating profile is_active:', profileError)
    return { error: 'Erreur lors de la mise à jour du statut.' }
  }

  return { success: true }
}

export async function updateTeamMemberRole(
  memberId: string,
  role: 'MANAGER' | 'SELLER'
): Promise<{ success?: true; error?: string }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'Accès refusé.' }

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
    return { error: 'Erreur lors de la mise à jour du rôle.' }
  }

  return { success: true }
}

export async function updateTeamMemberAllowedPages(
  memberId: string,
  allowedPages: string[]
): Promise<{ success?: true; error?: string }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'Accès refusé.' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const sanitized = allowedPages.filter((p) => APP_PAGE_KEYS.includes(p as AppPageKey))

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ allowed_pages: sanitized }).eq('id', memberId)
  if (error) {
    console.error('Error updating team member access:', error)
    return { error: 'Erreur lors de la mise à jour des accès.' }
  }

  return { success: true }
}

export async function resetTeamMemberPassword(
  memberId: string
): Promise<{ success?: true; newPassword?: string; error?: string }> {
  const currentProfile = await requireManager()
  if (!currentProfile) return { error: 'Accès refusé.' }

  const guardError = await assertManagesTeammate(currentProfile, memberId)
  if (guardError) return guardError

  const newPassword = generateTempPassword()
  const adminSupabase = createServiceRoleClient()
  const { error } = await adminSupabase.auth.admin.updateUserById(memberId, { password: newPassword })
  if (error) {
    console.error('Error resetting team member password:', error)
    return { error: 'Erreur lors de la réinitialisation.' }
  }

  return { success: true, newPassword }
}

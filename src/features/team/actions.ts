'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentProfile } from '@/features/auth/actions'

export async function inviteEmployee(formData: FormData) {
  const supabase = await createClient()

  // Only managers can create employees
  const currentProfile = await getCurrentProfile()
  if (!currentProfile || currentProfile.role !== 'MANAGER') {
    redirect('/fr/settings?error=Accès refusé')
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'SELLER' | 'MANAGER'

  if (!email || !password || !fullName) {
    redirect('/fr/settings?error=Tous les champs sont requis')
  }

  // Check if service_role key is available
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    redirect('/fr/settings?error=La clé service_role Supabase n\'est pas configurée. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  }

  // Use admin client to create user without email confirmation
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create user with admin API (bypasses email confirmation)
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm email
    user_metadata: { full_name: fullName },
  })

  if (createError || !newUser.user) {
    console.error('Error creating employee:', createError)
    redirect(`/fr/settings?error=Erreur: ${createError?.message}`)
  }

  // Update the profile created by the trigger to link it to the current shop
  // The trigger creates a new shop_id, so we need to override it
  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      shop_id: currentProfile.shop_id,
      role: role || 'SELLER',
      full_name: fullName,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    console.error('Error updating profile:', profileError)
    // User was created but profile not updated - still redirect with a warning
    redirect(`/fr/settings?error=Employé créé mais erreur de profil: ${profileError.message}`)
  }

  redirect('/fr/settings?message=Employé ajouté avec succès !')
}

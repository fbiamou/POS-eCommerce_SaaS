'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/fr/login?error=Identifiants invalides')
  }

  revalidatePath('/', 'layout')
  redirect('/fr')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error("Signup error:", error);
    redirect(`/fr/login?error=Erreur: ${error.message}`);
  }

  // Show confirmation message after signup (email confirmation required)
  redirect('/fr/login?message=Compte créé ! Vérifiez votre email pour confirmer votre compte.')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/fr/login')
}

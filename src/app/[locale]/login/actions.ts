'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { isPageAllowed, firstAllowedPath } from '@/lib/appPages'
import { redirectLocalized } from '@/lib/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return redirectLocalized('/login', { error: 'invalid_credentials' })
  }

  revalidatePath('/', 'layout')

  // Redirect straight to the right landing page here (a real server-side
  // redirect on this request) instead of always to "/" and relying on a
  // second redirect from the dashboard page — that second hop happens
  // during a client-side transition and doesn't reliably update the
  // browser's URL bar for a restricted employee.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, allowed_pages')
    .eq('id', signInData.user.id)
    .single()

  const landingPath =
    profile && !isPageAllowed(profile.role, profile.allowed_pages ?? [], '/dashboard')
      ? firstAllowedPath(profile.allowed_pages ?? [])
      : '/dashboard'

  return redirectLocalized(landingPath)
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
    return redirectLocalized('/login', { error: 'signup_failed' })
  }

  // Email confirmation is required before the first sign-in.
  return redirectLocalized('/login', { message: 'signup_check_email' })
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirectLocalized('/')
}

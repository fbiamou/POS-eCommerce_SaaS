'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/utils/supabase/server'
import { isPageAllowed, firstAllowedPath } from '@/lib/appPages'
import { redirectLocalized } from '@/lib/navigation'
import { TERMS_VERSION } from '@/lib/terms'
import { findShopCountry } from '@/lib/countries'
import { isStrongPassword } from '@/lib/password'

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
  // Creating a shop requires accepting the terms of use; the browser already
  // enforces the checkbox, this is the server-side guarantee.
  if (formData.get('accept_terms') !== 'on') {
    return redirectLocalized('/login', { mode: 'signup', error: 'terms_required' })
  }

  if (!isStrongPassword((formData.get('password') as string | null) ?? '')) {
    return redirectLocalized('/login', { mode: 'signup', error: 'password_weak' })
  }

  const supabase = await createClient()
  const fullName = ((formData.get('full_name') as string | null) ?? '').trim()
  const shopName = ((formData.get('shop_name') as string | null) ?? '').trim().slice(0, 80)
  const countryCode = findShopCountry(formData.get('country_code') as string)?.code ?? ''

  // The confirmation email leads back to this same site (/auth/confirm),
  // which signs the new owner in. Supabase only follows it if the address is
  // in its Redirect URLs; otherwise it falls back to its Site URL.
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const locale = await getLocale()
  const emailRedirectTo = host ? `${protocol}://${host}/auth/confirm?locale=${locale}` : undefined

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo,
      // full_name names the owner's profile, shop_name and country_code set up
      // the new shop (handle_new_user trigger); the terms fields record which
      // version was accepted, and when.
      data: {
        full_name: fullName,
        shop_name: shopName,
        country_code: countryCode,
        // The confirmation email is written in this language (Supabase
        // template: {{ .Data.locale }}).
        locale,
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  })

  if (error) {
    console.error("Signup error:", error);
    return redirectLocalized('/login', { mode: 'signup', error: 'signup_failed' })
  }

  // Email confirmation is required before the first sign-in.
  return redirectLocalized('/login', { message: 'signup_check_email' })
}

// "Create another shop" from a signed-in session: close it first, then open
// the sign-up form (a new account always creates a new shop).
export async function logoutToSignup() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirectLocalized('/login', { mode: 'signup' })
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirectLocalized('/')
}

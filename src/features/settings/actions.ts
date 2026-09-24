'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCurrentProfile } from '@/features/auth/actions'
import { redirectLocalized } from '@/lib/navigation'
import type { FeedbackCode } from '@/lib/feedback'
import { SHOP_TIME_ZONES } from '@/lib/timeZones'
import { DEFAULT_TIME_ZONE } from '@/lib/format'
import { findShopCountry } from '@/lib/countries'

// Every settings write is reserved to the shop's Propriétaire. The database
// enforces it too (RLS on `settings`, migration security_hardening); checking
// here first gives a clear message instead of a silent no-op.
async function requireManagerOrRedirect(tab: string) {
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return redirectLocalized('/login')
  if (currentProfile.role !== 'MANAGER') {
    return redirectLocalized('/settings', { tab, error: 'access_denied' })
  }
  return currentProfile
}

export async function updateShopProfile(formData: FormData) {
  const currentProfile = await requireManagerOrRedirect('profil')
  const supabase = await createClient()

  const vatRegistered = formData.get('vat_registered') === 'true'
  const vatRateInput = formData.get('vat_rate') as string
  const vatRateBps = vatRateInput ? Math.round(parseFloat(vatRateInput) * 100) : 1925

  const thresholdInput = (formData.get('low_stock_threshold') as string)?.trim()
  const lowStockThreshold = thresholdInput ? Number(thresholdInput) : 5
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
    return redirectLocalized('/settings', { tab: 'profil', error: 'threshold_invalid' })
  }

  const timeZoneInput = formData.get('timezone') as string
  const timeZone = SHOP_TIME_ZONES.some((z) => z.value === timeZoneInput) ? timeZoneInput : DEFAULT_TIME_ZONE

  // Only a country from the list is stored; "other country" leaves it empty.
  const countryCode = findShopCountry(formData.get('country_code') as string)?.code ?? null

  const updates: Record<string, string | number | boolean | null> = {
    country_code: countryCode,
    shop_name: formData.get('shop_name') as string || null,
    shop_phone: formData.get('shop_phone') as string || null,
    shop_address: formData.get('shop_address') as string || null,
    shop_email: formData.get('shop_email') as string || null,
    currency_code: formData.get('currency_code') as string || 'XAF',
    currency_symbol: formData.get('currency_symbol') as string || 'FCFA',
    default_phone_country_code: formData.get('default_phone_country_code') as string || '+237',
    tax_id: formData.get('tax_id') as string || null,
    trade_register: formData.get('trade_register') as string || null,
    vat_registered: vatRegistered,
    vat_rate_bps: vatRegistered ? vatRateBps : 1925,
    whatsapp_phone_number_id: (formData.get('whatsapp_phone_number_id') as string)?.trim() || null,
    whatsapp_template_name: (formData.get('whatsapp_template_name') as string)?.trim() || null,
    low_stock_threshold: lowStockThreshold,
    timezone: timeZone,
  }

  // The token field is masked client-side and left blank when unchanged —
  // only overwrite the stored token if the shop owner actually typed a new one.
  const whatsappApiToken = (formData.get('whatsapp_api_token') as string)?.trim()
  if (whatsappApiToken) updates.whatsapp_api_token = whatsappApiToken

  const { error } = await supabase
    .from('settings')
    .update(updates)
    .eq('shop_id', currentProfile.shop_id)

  if (error) {
    console.error('Update shop profile error:', error)
    return redirectLocalized('/settings', { tab: 'profil', error: 'update_failed' })
  }

  revalidatePath('/', 'layout')
  return redirectLocalized('/settings', { tab: 'profil', message: 'shop_profile_updated' })
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function updateShopSlug(formData: FormData): Promise<{ success?: true; slug?: string; error?: FeedbackCode }> {
  const supabase = await createClient()

  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return { error: 'unauthorized' }
  if (currentProfile.role !== 'MANAGER') return { error: 'access_denied' }

  const rawInput = (formData.get('shop_slug') as string)?.trim()
  if (!rawInput) return { error: 'slug_empty' }

  const slug = slugify(rawInput)
  if (!slug) return { error: 'slug_invalid' }

  // Another shop's settings row is invisible under RLS: a taken slug is
  // detected through the public lookup instead.
  const { data: existing } = await supabase.rpc('get_public_shop_profile', { _shop_slug: slug })
  const owner = (existing as { shop_id: string }[] | null)?.[0]
  if (owner && owner.shop_id !== currentProfile.shop_id) {
    return { error: 'slug_taken' }
  }

  const { error } = await supabase
    .from('settings')
    .update({ shop_slug: slug })
    .eq('shop_id', currentProfile.shop_id)

  if (error) {
    console.error('Update shop slug error:', error)
    return { error: error.code === '23505' ? 'slug_taken' : 'update_failed' }
  }

  revalidatePath('/settings')
  revalidatePath(`/boutique/${slug}`)
  return { success: true, slug }
}

export async function updateAppearance(formData: FormData) {
  const currentProfile = await requireManagerOrRedirect('boutique')
  const supabase = await createClient()

  const updates = {
    theme_accent_color: formData.get('theme_accent_color') as string || '#7c3aed',
    theme_font: formData.get('theme_font') as string || 'Geist',
  }

  const { error } = await supabase
    .from('settings')
    .update(updates)
    .eq('shop_id', currentProfile.shop_id)

  if (error) {
    console.error('Update appearance error:', error)
    return redirectLocalized('/settings', { tab: 'boutique', error: 'update_failed' })
  }

  revalidatePath('/', 'layout')
  return redirectLocalized('/settings', { tab: 'boutique', message: 'appearance_updated' })
}

export async function updateOwnerProfile(formData: FormData) {
  const supabase = await createClient()
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return redirectLocalized('/login')

  const fullName = formData.get('full_name') as string
  if (!fullName?.trim()) {
    return redirectLocalized('/settings', { tab: 'profil', error: 'name_required' })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', currentProfile.id)

  if (error) {
    console.error('Update owner profile error:', error)
    return redirectLocalized('/settings', { tab: 'profil', error: 'update_failed' })
  }

  revalidatePath('/', 'layout')
  return redirectLocalized('/settings', { tab: 'profil', message: 'profile_updated' })
}

export async function uploadShopLogo(formData: FormData) {
  const currentProfile = await requireManagerOrRedirect('profil')
  const supabase = await createClient()

  const file = formData.get('logo') as File
  if (!file || file.size === 0) {
    return redirectLocalized('/settings', { tab: 'profil', error: 'no_file_selected' })
  }

  const ext = file.name.split('.').pop()
  const filePath = `${currentProfile.shop_id}/logo.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('shop-assets')
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Logo upload error:', uploadError)
    return redirectLocalized('/settings', { tab: 'profil', error: 'logo_upload_failed' })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('shop-assets')
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('settings')
    .update({ shop_logo_url: publicUrl })
    .eq('shop_id', currentProfile.shop_id)

  if (updateError) {
    return redirectLocalized('/settings', { tab: 'profil', error: 'logo_saved_update_failed' })
  }

  revalidatePath('/', 'layout')
  return redirectLocalized('/settings', { tab: 'profil', message: 'logo_updated' })
}

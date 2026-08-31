'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentProfile } from '@/features/auth/actions'

export type ShopSettings = {
  id: string
  shop_id: string
  shop_name: string | null
  shop_phone: string | null
  shop_address: string | null
  shop_email: string | null
  shop_logo_url: string | null
  currency_code: string
  currency_symbol: string
  theme_accent_color: string
  theme_font: string
  reminder_first_delay_days: number
  reminder_recurring_delay_days: number
  tax_id: string | null
  trade_register: string | null
  vat_registered: boolean
  vat_rate_bps: number
  whatsapp_phone_number_id: string | null
  whatsapp_api_token: string | null
  whatsapp_template_name: string | null
  shop_slug: string | null
}

export async function getShopSettings(): Promise<ShopSettings | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single()

  if (error) {
    console.error('Error fetching settings:', error)
    return null
  }

  return data
}

export async function updateShopProfile(formData: FormData) {
  const supabase = await createClient()

  const currentProfile = await getCurrentProfile()
  if (!currentProfile) redirect('/fr/login')

  const vatRegistered = formData.get('vat_registered') === 'true'
  const vatRateInput = formData.get('vat_rate') as string
  const vatRateBps = vatRateInput ? Math.round(parseFloat(vatRateInput) * 100) : 1925

  const updates: Record<string, string | number | boolean | null> = {
    shop_name: formData.get('shop_name') as string || null,
    shop_phone: formData.get('shop_phone') as string || null,
    shop_address: formData.get('shop_address') as string || null,
    shop_email: formData.get('shop_email') as string || null,
    currency_code: formData.get('currency_code') as string || 'XAF',
    currency_symbol: formData.get('currency_symbol') as string || 'FCFA',
    tax_id: formData.get('tax_id') as string || null,
    trade_register: formData.get('trade_register') as string || null,
    vat_registered: vatRegistered,
    vat_rate_bps: vatRegistered ? vatRateBps : 1925,
    whatsapp_phone_number_id: (formData.get('whatsapp_phone_number_id') as string)?.trim() || null,
    whatsapp_template_name: (formData.get('whatsapp_template_name') as string)?.trim() || null,
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
    redirect('/fr/settings?tab=profil&error=Erreur lors de la mise à jour')
  }

  revalidatePath('/', 'layout')
  redirect('/fr/settings?tab=profil&message=Profil boutique mis à jour !')
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

export async function updateShopSlug(formData: FormData): Promise<{ success?: true; slug?: string; error?: string }> {
  const supabase = await createClient()

  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return { error: 'Non autorisé.' }

  const rawInput = (formData.get('shop_slug') as string)?.trim()
  if (!rawInput) return { error: "L'adresse de la boutique en ligne ne peut pas être vide." }

  const slug = slugify(rawInput)
  if (!slug) return { error: 'Adresse invalide — utilisez des lettres, chiffres et tirets.' }

  const { data: existing } = await supabase
    .from('settings')
    .select('shop_id')
    .eq('shop_slug', slug)
    .maybeSingle()

  if (existing && existing.shop_id !== currentProfile.shop_id) {
    return { error: 'Cette adresse est déjà utilisée par une autre boutique.' }
  }

  const { error } = await supabase
    .from('settings')
    .update({ shop_slug: slug })
    .eq('shop_id', currentProfile.shop_id)

  if (error) {
    console.error('Update shop slug error:', error)
    return { error: 'Erreur lors de la mise à jour.' }
  }

  revalidatePath('/settings')
  revalidatePath(`/boutique/${slug}`)
  return { success: true, slug }
}

export async function updateAppearance(formData: FormData) {
  const supabase = await createClient()

  const currentProfile = await getCurrentProfile()
  if (!currentProfile) redirect('/fr/login')

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
    redirect('/fr/settings?tab=boutique&error=Erreur lors de la mise à jour')
  }

  revalidatePath('/', 'layout')
  redirect('/fr/settings?tab=boutique&message=Apparence mise à jour !')
}

export async function updateOwnerProfile(formData: FormData) {
  const supabase = await createClient()
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) redirect('/fr/login')

  const fullName = formData.get('full_name') as string
  if (!fullName?.trim()) {
    redirect('/fr/settings?tab=profil&error=Le nom est requis')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', currentProfile.id)

  if (error) {
    console.error('Update owner profile error:', error)
    redirect('/fr/settings?tab=profil&error=Erreur lors de la mise à jour')
  }

  revalidatePath('/', 'layout')
  redirect('/fr/settings?tab=profil&message=Profil mis à jour !')
}

export async function uploadShopLogo(formData: FormData) {
  const supabase = await createClient()
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) redirect('/fr/login')

  const file = formData.get('logo') as File
  if (!file || file.size === 0) {
    redirect('/fr/settings?tab=profil&error=Aucun fichier sélectionné')
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
    redirect(`/fr/settings?tab=profil&error=Erreur upload: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('shop-assets')
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('settings')
    .update({ shop_logo_url: publicUrl })
    .eq('shop_id', currentProfile.shop_id)

  if (updateError) {
    redirect('/fr/settings?tab=profil&error=Logo uploadé mais erreur de mise à jour')
  }

  revalidatePath('/', 'layout')
  redirect('/fr/settings?tab=profil&message=Logo mis à jour avec succès !')
}

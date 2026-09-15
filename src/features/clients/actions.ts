'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCurrentProfile } from '@/features/auth/actions'

function buildPhone(formData: FormData): string | null {
  const countryCode = (formData.get('phone_country_code') as string) || ''
  const digits = ((formData.get('phone') as string) || '').replace(/\D/g, '')
  return digits ? `${countryCode}${digits}` : null
}

export async function addClient(formData: FormData): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return { error: 'Non autorisé.' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom est requis.' }

  const { error } = await supabase.from('clients').insert({
    shop_id: currentProfile.shop_id,
    name,
    phone: buildPhone(formData),
  })

  if (error) {
    console.error('Error creating client:', error)
    return { error: 'Erreur lors de la création du client.' }
  }

  revalidatePath('/clients')
  return { success: true }
}

export async function updateClient(
  clientId: string,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const currentProfile = await getCurrentProfile()
  if (!currentProfile) return { error: 'Non autorisé.' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom est requis.' }

  const { error } = await supabase
    .from('clients')
    .update({ name, phone: buildPhone(formData) })
    .eq('id', clientId)
    .eq('shop_id', currentProfile.shop_id)

  if (error) {
    console.error('Error updating client:', error)
    return { error: 'Erreur lors de la mise à jour du client.' }
  }

  revalidatePath('/clients')
  return { success: true }
}

import { getCurrentProfile, getTeamMembers } from '@/features/auth/actions'
import { updateShopProfile, updateAppearance, updateOwnerProfile } from '@/features/settings/actions'
import { getShopSettings } from '@/features/settings/queries'
import { readFeedbackParam } from '@/lib/feedback'
import { SHOP_TIME_ZONES } from '@/lib/timeZones'
import { inviteEmployee } from '@/features/team/actions'
import { EmployeeAccessFields } from '@/features/team/components/EmployeeAccessFields'
import { TeamMemberRow } from '@/features/team/components/TeamMemberRow'
import { LogoUploadButton } from '@/features/settings/components/LogoUploadButton'
import { ShopSlugField } from '@/features/settings/components/ShopSlugField'
import { CurrencySelect } from '@/features/settings/components/CurrencySelect'
import { PHONE_COUNTRY_CODES } from '@/lib/phoneCountryCodes'
import { getTranslations } from 'next-intl/server'
import {
  UserCircle, ShieldCheck, ShoppingBag, Plus, Building2,
  Palette, Users, Check
} from 'lucide-react'
import Image from 'next/image'

const ACCENT_COLORS = [
  { value: '#7c3aed', key: 'color_violet', className: 'bg-violet-600' },
  { value: '#2563eb', key: 'color_blue', className: 'bg-blue-600' },
  { value: '#16a34a', key: 'color_green', className: 'bg-green-600' },
  { value: '#dc2626', key: 'color_red', className: 'bg-red-600' },
  { value: '#d97706', key: 'color_orange', className: 'bg-amber-600' },
  { value: '#db2777', key: 'color_pink', className: 'bg-pink-600' },
  { value: '#0891b2', key: 'color_cyan', className: 'bg-cyan-600' },
  { value: '#374151', key: 'color_grey', className: 'bg-gray-700' },
] as const

const FONTS = ['Geist', 'Inter', 'Roboto', 'Outfit', 'Poppins']

export async function generateMetadata() {
  const t = await getTranslations('Settings')
  return { title: t('title') }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; tab?: string; login?: string }>
}) {
  const params = await searchParams
  const activeTab = params.tab ?? 'profil'
  // Only known feedback codes are displayed: a crafted link cannot make this
  // page show arbitrary text.
  const error = readFeedbackParam(params.error)
  const message = readFeedbackParam(params.message)

  const [t, tFeedback, currentProfile, teamMembers, shopSettings] = await Promise.all([
    getTranslations('Settings'),
    getTranslations('Feedback'),
    getCurrentProfile(),
    getTeamMembers(),
    getShopSettings(),
  ])

  const isManager = currentProfile?.role === 'MANAGER'

  const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    MANAGER: {
      label: t('role_manager'),
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    },
    SELLER: {
      label: t('role_cashier'),
      icon: <ShoppingBag className="h-3.5 w-3.5" />,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
  }

  const tabs = [
    { id: 'profil', label: t('tab_profile'), icon: <UserCircle className="h-4 w-4" /> },
    { id: 'boutique', label: t('tab_shop'), icon: <Palette className="h-4 w-4" /> },
    { id: 'equipe', label: t('tab_team'), icon: <Users className="h-4 w-4" /> },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-3 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
          <span>⚠️</span><span>{tFeedback(error)}</span>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <span>✅</span><span>{tFeedback(message, { login: params.login ?? '' })}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-2xl bg-zinc-50 dark:bg-[var(--line)]/50 p-1">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`?tab=${tab.id}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[13px] font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[var(--surface-1)] text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/50 dark:ring-white/10'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </a>
        ))}
      </div>

      {/* ====== PROFIL ====== */}
      {activeTab === 'profil' && (
        <div className="flex flex-col gap-6">

          {/* Profil personnel */}
          <section className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[var(--line)] bg-transparent">
              <h2 className="font-bold text-zinc-900 dark:text-white">{t('my_profile')}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t('my_profile_subtitle')}</p>
            </div>
            <form action={updateOwnerProfile} className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 flex-shrink-0">
                  <UserCircle className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 dark:text-white">{currentProfile?.full_name || t('no_name')}</p>
                  {currentProfile?.role && ROLE_CONFIG[currentProfile.role] && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full mt-1 ${ROLE_CONFIG[currentProfile.role].color}`}>
                      {ROLE_CONFIG[currentProfile.role].icon}
                      {ROLE_CONFIG[currentProfile.role].label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="full_name">
                  {t('full_name')}
                </label>
                <input id="full_name" name="full_name" type="text" defaultValue={currentProfile?.full_name || ''}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm">
                  <Check className="h-4 w-4" /> {t('save')}
                </button>
              </div>
            </form>
          </section>

          {/* Profil boutique */}
          <section className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[var(--line)] bg-transparent">
              <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Building2 className="h-4 w-4" /> {t('shop_profile')}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t('shop_profile_subtitle')}</p>
            </div>

            {/* Logo */}
            <div className="px-6 pt-6 pb-2">
              <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 mb-3">{t('shop_logo')}</p>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-900/20 overflow-hidden flex-shrink-0">
                  {shopSettings?.shop_logo_url ? (
                    <Image src={shopSettings.shop_logo_url} alt={t('shop_logo')} width={64} height={64} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                      {shopSettings?.shop_name?.[0]?.toUpperCase() || 'B'}
                    </span>
                  )}
                </div>
                <LogoUploadButton />
              </div>
            </div>

            {/* Boutique en ligne */}
            <div className="px-6 pt-4 pb-2">
              <ShopSlugField initialSlug={shopSettings?.shop_slug ?? null} />
            </div>

            <form action={updateShopProfile} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="shop_name">{t('shop_name')}</label>
                  <input id="shop_name" name="shop_name" type="text" defaultValue={shopSettings?.shop_name || ''} placeholder={t('shop_name_placeholder')}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="shop_phone">{t('phone')}</label>
                  <input id="shop_phone" name="shop_phone" type="tel" defaultValue={shopSettings?.shop_phone || ''} placeholder="+237 6XX XXX XXX"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="default_phone_country_code">{t('default_phone_country_code')}</label>
                  <select id="default_phone_country_code" name="default_phone_country_code" defaultValue={shopSettings?.default_phone_country_code || '+237'}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
                    {PHONE_COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} {c.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{t('default_phone_country_code_hint')}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="shop_email">{t('email')}</label>
                  <input id="shop_email" name="shop_email" type="email" defaultValue={shopSettings?.shop_email || ''} placeholder="contact@maboutique.com"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="currency_code">{t('currency')}</label>
                  <CurrencySelect
                    defaultCode={shopSettings?.currency_code || 'XAF'}
                    defaultSymbol={shopSettings?.currency_symbol || 'FCFA'}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="timezone">{t('timezone')}</label>
                  <select id="timezone" name="timezone" defaultValue={shopSettings?.timezone || 'Africa/Douala'}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
                    {SHOP_TIME_ZONES.map((z) => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{t('timezone_hint')}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="low_stock_threshold">{t('low_stock_threshold')}</label>
                  <input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" step="1" defaultValue={shopSettings?.low_stock_threshold ?? 5}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  <p className="text-[11px] text-zinc-500 mt-0.5">{t('low_stock_threshold_hint')}</p>
                </div>
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="shop_address">{t('address')}</label>
                  <textarea id="shop_address" name="shop_address" rows={2} defaultValue={shopSettings?.shop_address || ''} placeholder={t('address_placeholder')}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)] resize-none" />
                </div>
              </div>

              <div className="border-t border-zinc-100 dark:border-[var(--line)] pt-6">
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white mb-1">{t('tax_info')}</p>
                <p className="text-[11px] text-zinc-400 mb-4">{t('tax_info_subtitle')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="tax_id">{t('tax_id')}</label>
                    <input id="tax_id" name="tax_id" type="text" defaultValue={shopSettings?.tax_id || ''} placeholder={t('tax_id_placeholder')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="trade_register">{t('trade_register')}</label>
                    <input id="trade_register" name="trade_register" type="text" defaultValue={shopSettings?.trade_register || ''} placeholder={t('trade_register_placeholder')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <input
                      id="vat_registered"
                      name="vat_registered"
                      type="checkbox"
                      value="true"
                      defaultChecked={shopSettings?.vat_registered ?? false}
                      className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]"
                    />
                    <label htmlFor="vat_registered" className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t('vat_registered')}</label>
                    <input id="vat_rate" name="vat_rate" type="number" step="0.01" min="0" max="100"
                      defaultValue={((shopSettings?.vat_rate_bps ?? 1925) / 100).toFixed(2)}
                      className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                    <span className="text-[13px] font-bold text-zinc-500">% {t('vat_rate_label')}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-100 dark:border-[var(--line)] pt-6">
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white mb-1">{t('whatsapp_section')}</p>
                <p className="text-[11px] text-zinc-400 mb-4">{t('whatsapp_section_subtitle')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="whatsapp_phone_number_id">{t('whatsapp_phone_number_id')}</label>
                    <input id="whatsapp_phone_number_id" name="whatsapp_phone_number_id" type="text" defaultValue={shopSettings?.whatsapp_phone_number_id || ''} placeholder="123456789012345"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="whatsapp_template_name">{t('whatsapp_template_name')}</label>
                    <input id="whatsapp_template_name" name="whatsapp_template_name" type="text" defaultValue={shopSettings?.whatsapp_template_name || ''} placeholder="payment_reminder"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="whatsapp_api_token">{t('whatsapp_api_token')}</label>
                    <input id="whatsapp_api_token" name="whatsapp_api_token" type="password" autoComplete="off"
                      placeholder={shopSettings?.whatsapp_token_set ? t('whatsapp_token_configured') : ''}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                    <p className="text-[11px] text-zinc-500 mt-0.5">{t('whatsapp_token_hint')}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm">
                  <Check className="h-4 w-4" /> {t('save_shop_profile')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ====== BOUTIQUE (APPARENCE) ====== */}
      {activeTab === 'boutique' && (
        <section className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-[var(--line)] bg-transparent">
            <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Palette className="h-4 w-4" /> {t('appearance')}</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">{t('appearance_subtitle')}</p>
          </div>
          <form action={updateAppearance} className="p-6 space-y-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 mb-3">{t('accent_color')}</label>
              <div className="flex flex-wrap gap-3">
                {ACCENT_COLORS.map((color) => (
                  <label key={color.value} className="cursor-pointer group" title={t(color.key)}>
                    <input type="radio" name="theme_accent_color" value={color.value}
                      defaultChecked={shopSettings?.theme_accent_color === color.value || (!shopSettings?.theme_accent_color && color.value === '#7c3aed')}
                      className="sr-only" />
                    <div className={`h-9 w-9 rounded-full ${color.className} flex items-center justify-center ring-2 ring-offset-2 ring-transparent group-has-[:checked]:ring-current transition-all dark:ring-offset-[var(--surface-1)]`}>
                      <Check className="h-4 w-4 text-white opacity-0 group-has-[:checked]:opacity-100 transition-opacity" />
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="theme_font">{t('font')}</label>
              <select id="theme_font" name="theme_font" defaultValue={shopSettings?.theme_font || 'Geist'}
                className="w-full md:w-64 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
                {FONTS.map(f => <option key={f} value={f}>{f === 'Geist' ? t('font_default', { name: f }) : f}</option>)}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm">
                <Check className="h-4 w-4" /> {t('apply_appearance')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ====== ÉQUIPE ====== */}
      {activeTab === 'equipe' && (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[var(--line)] bg-transparent flex items-center justify-between">
              <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Users className="h-4 w-4" /> {t('team')}</h2>
              <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{t('members_count', { count: teamMembers.length })}</span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-[var(--line)]">
              {teamMembers.length === 0 ? (
                <p className="p-6 text-[13px] text-zinc-400 text-center">{t('no_members')}</p>
              ) : teamMembers.map((member) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === currentProfile?.id}
                  roleLabels={{ MANAGER: t('role_manager'), SELLER: t('role_cashier') }}
                />
              ))}
            </div>
          </section>

          {isManager && (
            <section className="rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-[var(--line)] bg-transparent">
                <h2 className="font-bold text-zinc-900 dark:text-white">{t('add_employee')}</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('add_employee_subtitle')}</p>
              </div>
              <form action={inviteEmployee} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="full_name_emp">{t('full_name')}</label>
                    <input id="full_name_emp" name="full_name" type="text" required placeholder={t('employee_name_placeholder')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="email_emp">{t('employee_email')}</label>
                    <input id="email_emp" name="email" type="email" placeholder={t('employee_email_placeholder')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                    <p className="text-[11px] text-zinc-500 mt-0.5">{t('employee_email_hint')}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="password_emp">{t('temp_password')}</label>
                    <input id="password_emp" name="password" type="password" required minLength={6} placeholder={t('password_min_hint')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
                  </div>
                  <EmployeeAccessFields />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm">
                    <Plus className="h-4 w-4" /> {t('create_access')}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

import { login, logoutToSignup, requestPasswordReset, signup } from './actions'
import { getCurrentProfile } from '@/features/auth/actions'
import { getShopSettings } from '@/features/settings/queries'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { WishopMark } from '@/components/brand/WishopMark'
import { readFeedbackParam } from '@/lib/feedback'
import { termsPathFor } from '@/lib/terms'
import { Select } from '@/components/ui/Select'
import { SHOP_COUNTRIES } from '@/lib/countries'
import { PasswordField } from '@/components/PasswordField'
import { MailCheck } from 'lucide-react'

export async function generateMetadata() {
  const t = await getTranslations('Auth')
  return { title: t('sign_in') }
}

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-3 text-[15px] font-medium transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]'
const labelClass = 'text-[13px] font-semibold text-zinc-700 dark:text-zinc-300'

// One page, two forms: signing in, and creating a shop (the landing page's
// "Créer ma boutique" buttons open it with ?mode=signup). Creating an account
// always creates a new shop, and requires accepting the terms of use.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; mode?: string }>
}) {
  const t = await getTranslations('Auth')
  const tFeedback = await getTranslations('Feedback')
  const tSettings = await getTranslations('Settings')
  const termsPath = termsPathFor(await getLocale())
  const params = await searchParams
  // Only known feedback codes are displayed: a crafted link cannot make this
  // page show arbitrary text.
  const error = readFeedbackParam(params.error)
  const message = readFeedbackParam(params.message)
  const isSignup = params.mode === 'signup'
  // Right after creating a shop: only the "check your email" step is shown.
  const checkEmail = message === 'signup_check_email'
  const isReset = params.mode === 'reset'
  // Only reachable signed in through ?mode=signup (see proxy.ts).
  const profile = isSignup ? await getCurrentProfile() : null
  const currentShop = profile ? await getShopSettings() : null

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-center text-[14px] font-semibold transition-colors ${
      active ? 'bg-[var(--surface-1)] text-zinc-900 shadow-card dark:bg-[var(--surface-3)] dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
    }`

  return (
    <div className="min-h-dvh w-full bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel: indigo night, the thread and the three promises */}
      <aside className="relative hidden overflow-hidden bg-night px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <WishopMark className="h-7 w-auto text-white" />
          <span className="font-display text-[22px] font-extrabold tracking-tight">{t('title')}</span>
        </div>
        <div>
          <h1 className="max-w-[14ch] font-display text-[44px] font-extrabold leading-[1.05] tracking-tight">{t('tagline')}</h1>
          <svg viewBox="0 0 180 26" aria-hidden="true" className="mt-6 h-auto w-44">
            <polyline points="2,18 11,6 20,18 29,6 38,18 47,6 56,18 65,6 74,18 83,6 92,18 101,6 110,18 119,6 128,18 137,6 146,18 155,6 164,18 173,6" fill="none" stroke="#9DAEE2" strokeWidth="3" />
            <path d="M119 -2.5 L124 2.5 L119 7.5 L114 2.5Z" fill="#F4B63F" />
          </svg>
          <ul className="mt-8 space-y-3 text-[16px] text-[#C9CFE6]">
            <li>{t('point_till')}</li>
            <li>{t('point_credit')}</li>
            <li>{t('point_free')}</li>
          </ul>
        </div>
        <p className="text-[13px] text-[#9AA1BD]">{t('subtitle')}</p>
      </aside>

      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:min-h-0 lg:justify-center">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between lg:hidden">
          <div className="flex items-center gap-2 text-night dark:text-white">
            <WishopMark className="h-6 w-auto" />
            <span className="font-display text-[19px] font-extrabold tracking-tight">{t('title')}</span>
          </div>
          <LocaleSwitcher variant="dropdown" />
        </div>
        <div className="mx-auto hidden w-full max-w-[420px] justify-end lg:flex">
          <LocaleSwitcher variant="dropdown" />
        </div>

        <div className="mx-auto mt-10 w-full max-w-[420px] lg:mt-8">
          {isReset ? (
            <>
              <h2 className="font-display text-[28px] font-extrabold tracking-tight">{t('reset_heading')}</h2>
              <p className="mt-1 text-[15px] text-zinc-500">{t('reset_sub')}</p>
            </>
          ) : !checkEmail && (
          <>
          <h2 className="font-display text-[28px] font-extrabold tracking-tight">
            {isSignup ? t('signup_heading') : t('signin_heading')}
          </h2>
          <p className="mt-1 text-[15px] text-zinc-500">{isSignup ? t('signup_sub') : t('signin_sub')}</p>

          <nav aria-label={t('title')} className="mt-6 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[var(--surface-2)]">
            <Link href="/login" aria-current={!isSignup ? 'page' : undefined} className={tabClass(!isSignup)}>
              {t('sign_in')}
            </Link>
            <Link href="/login?mode=signup" aria-current={isSignup ? 'page' : undefined} className={tabClass(isSignup)}>
              {t('create_shop')}
            </Link>
          </nav>
          </>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-[14px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {tFeedback(error)}
            </p>
          )}
          {message && message !== 'signup_check_email' && (
            <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-[14px] font-medium text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {tFeedback(message)}
            </p>
          )}

          {checkEmail ? (
            <section role="status" aria-live="polite" className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-[var(--surface-1)] px-6 py-8 text-center shadow-card ring-2 ring-violet-500/40 animate-[wishop-pop_0.5s_ease-out]">
              <span className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/30" aria-hidden="true" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-violet-600 text-white">
                  <MailCheck className="h-9 w-9 animate-[wishop-float_1.8s_ease-in-out_infinite]" />
                </span>
              </span>
              <h3 className="font-display text-[22px] font-extrabold tracking-tight">{t('check_email_title')}</h3>
              <p className="text-[15px] text-zinc-600 dark:text-zinc-300">{t('check_email_body')}</p>
              <ol className="w-full space-y-2 text-left text-[14px]">
                <li className="flex gap-3 rounded-xl bg-zinc-100/70 p-3 dark:bg-[var(--surface-2)]"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">1</span>{t('check_email_step1')}</li>
                <li className="flex gap-3 rounded-xl bg-zinc-100/70 p-3 dark:bg-[var(--surface-2)]"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">2</span>{t('check_email_step2')}</li>
                <li className="flex gap-3 rounded-xl bg-zinc-100/70 p-3 dark:bg-[var(--surface-2)]"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">3</span>{t('check_email_step3')}</li>
              </ol>
              <p className="text-[13px] text-zinc-500">{t('check_email_spam')}</p>
              <Link href="/login" className="w-full rounded-xl bg-violet-600 py-3.5 text-center text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
                {t('check_email_done')}
              </Link>
            </section>
          ) : isReset ? (
            <form action={requestPasswordReset} className="mt-6 flex flex-col gap-4">
              {message !== 'reset_email_sent' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass} htmlFor="email">{t('email')}</label>
                    <input id="email" name="email" type="email" autoComplete="email" required placeholder={t('email_placeholder')} className={inputClass} />
                  </div>
                  <button type="submit" className="mt-1 w-full rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
                    {t('reset_send')}
                  </button>
                </>
              )}
              <Link href="/login" className="text-center text-[14px] font-semibold text-violet-700 hover:underline dark:text-violet-300">
                {t('back_to_signin')}
              </Link>
            </form>
          ) : isSignup && profile ? (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card">
              <p className="text-[15px]">
                {t.rich('already_signed_in', {
                  shop: currentShop?.shop_name || t('title'),
                  strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                })}
              </p>
              <Link href="/dashboard" className="w-full rounded-xl bg-violet-600 py-3.5 text-center text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
                {t('open_my_shop')}
              </Link>
              <form action={logoutToSignup}>
                <button type="submit" className="w-full rounded-xl py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300">
                  {t('sign_out_create_other')}
                </button>
              </form>
            </div>
          ) : isSignup ? (
            <form action={signup} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="full_name">{t('full_name')}</label>
                <input id="full_name" name="full_name" type="text" autoComplete="name" required placeholder={t('full_name_placeholder')} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="shop_name">{t('shop_name')}</label>
                <input id="shop_name" name="shop_name" type="text" autoComplete="organization" required placeholder={t('shop_name_placeholder')} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="country_code">{tSettings('country')}</label>
                <Select
                  id="country_code"
                  name="country_code"
                  defaultValue="GQ"
                  triggerClassName="py-3 text-[15px]"
                  options={[
                    ...SHOP_COUNTRIES.map((c) => ({ value: c.code, label: tSettings(`country_${c.code}`) })),
                    { value: '', label: tSettings('country_other') },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="email">{t('email')}</label>
                <input id="email" name="email" type="email" autoComplete="email" required placeholder={t('email_placeholder')} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="password">{t('password')}</label>
                <PasswordField id="password" name="password" inputClassName={inputClass} />
              </div>
              <label htmlFor="accept_terms" className="flex items-start gap-3 rounded-xl bg-zinc-100/70 p-3 text-[14px] leading-snug dark:bg-[var(--surface-2)]">
                <input id="accept_terms" name="accept_terms" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent-bg)]" />
                <span>
                  {t.rich('accept_terms', {
                    link: (chunks) => (
                      // A static page served from /public, not an app route: a plain link is intended.
                      <a href={termsPath} target="_blank" rel="noopener" className="font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300">
                        {chunks}
                      </a>
                    ),
                  })}
                </span>
              </label>
              <button type="submit" className="mt-1 w-full rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
                {t('create_shop')}
              </button>
              <p className="text-center text-[13px] text-zinc-500">{t('free_note')}</p>
            </form>
          ) : (
            <form action={login} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="email">{t('email')}</label>
                <input id="email" name="email" type="email" autoComplete="email" required placeholder={t('email_placeholder')} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="password">{t('password')}</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
                <Link href="/login?mode=reset" className="self-end text-[13px] font-semibold text-violet-700 hover:underline dark:text-violet-300">
                  {t('forgot_password')}
                </Link>
              </div>
              <button type="submit" className="mt-1 w-full rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
                {t('sign_in')}
              </button>
              <p className="text-center text-[14px] text-zinc-500">
                {t('no_account')}{' '}
                <Link href="/login?mode=signup" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
                  {t('create_shop')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

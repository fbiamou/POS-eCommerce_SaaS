import { login, signup } from './actions'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { readFeedbackParam } from '@/lib/feedback'

export async function generateMetadata() {
  const t = await getTranslations('Auth')
  return { title: t('sign_in') }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const t = await getTranslations('Auth')
  const tFeedback = await getTranslations('Feedback')
  const params = await searchParams
  // Only known feedback codes are displayed: a crafted link cannot make this
  // page show arbitrary text.
  const error = readFeedbackParam(params.error)
  const message = readFeedbackParam(params.message)

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 dark:bg-[#14121a] p-4">
      <div className="w-full max-w-[400px] space-y-6">

        {/* Language switcher */}
        <div className="flex justify-end">
          <LocaleSwitcher variant="dropdown" />
        </div>

        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-lg mb-2">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-zinc-500">{t('subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1C1A22] rounded-2xl border border-zinc-100 dark:border-[#2d2936] shadow-sm p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('sign_in')}</h2>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
              <span>⚠️</span>
              <span>{tFeedback(error)}</span>
            </div>
          )}

          {/* Success/info message */}
          {message && (
            <div className="flex items-start gap-3 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <span>✅</span>
              <span>{tFeedback(message)}</span>
            </div>
          )}

          <form className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="email">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={t('email_placeholder')}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300" htmlFor="password">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
              />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button
                formAction={login}
                className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm"
              >
                {t('sign_in')}
              </button>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-100 dark:border-[#2d2936]" />
                <span className="text-[11px] font-bold text-zinc-400">{t('or')}</span>
                <div className="flex-1 border-t border-zinc-100 dark:border-[#2d2936]" />
              </div>
              <button
                formAction={signup}
                className="w-full rounded-xl border border-zinc-200 bg-white dark:border-[#2d2936] dark:bg-white/5 px-5 py-2.5 text-[13px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors shadow-sm"
              >
                {t('sign_up')}
              </button>
            </div>
          </form>

          <p className="text-xs text-center text-zinc-400">
            {t('terms')}
          </p>
        </div>
      </div>
    </div>
  )
}

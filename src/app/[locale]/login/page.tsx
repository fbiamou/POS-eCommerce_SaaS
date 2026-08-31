import { login, signup } from './actions'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const t = await getTranslations('Auth')
  const { error, message } = await searchParams

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-violet-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Language switcher */}
        <div className="flex justify-end">
          <LocaleSwitcher variant="pills" />
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 space-y-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{t('sign_in')}</h2>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success/info message */}
          {message && (
            <div className="flex items-start gap-3 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <span>✅</span>
              <span>{message}</span>
            </div>
          )}

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="email">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={t('email_placeholder')}
                className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="password">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button
                formAction={login}
                className="w-full px-4 py-2.5 text-white bg-violet-600 rounded-lg hover:bg-violet-700 font-medium transition-colors"
              >
                {t('sign_in')}
              </button>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                <span className="text-xs text-zinc-400">{t('or')}</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <button
                formAction={signup}
                className="w-full px-4 py-2.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
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

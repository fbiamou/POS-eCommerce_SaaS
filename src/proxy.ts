import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isPageAllowed, firstAllowedPath, firstOpenPath } from './lib/appPages';
import { CASHIER_COOKIE, cashierFromCookie } from './lib/cashierSession';
import { PIN_COOKIE, pinSeconds } from './lib/versionPin';

const intlMiddleware = createMiddleware(routing);

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Next.js 16 renamed Middleware to Proxy (same behavior, new file name).
export async function proxy(request: NextRequest) {
  // 1. Refresh the Supabase session FIRST. The refreshed cookies are written
  //    onto the request itself, so everything rendered after the proxy (the
  //    layout, the page, server actions) sees the new access token.
  //    The order matters: next-intl copies the request headers when it builds
  //    its response. Running it first handed pages the expired token, and
  //    each page then tried to refresh it with a refresh token the proxy had
  //    already consumed: pages randomly rendered as signed out ("Sans nom").
  const refreshedCookies: CookieToSet[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          refreshedCookies.push(...cookiesToSet)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Every response leaving the proxy, redirects included, carries the
  // refreshed cookies: otherwise the browser keeps the old refresh token,
  // already consumed, and the session is lost on the next request.
  // A signed-in device stays on this version of WISHOP until its user
  // updates (lib/versionPin.ts, only with Vercel Skew Protection). Renewed at
  // each page load, never beyond the version's window.
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID
  const keepVersion = (response: NextResponse) => {
    if (!user || !deploymentId || process.env.VERCEL_SKEW_PROTECTION_ENABLED !== '1') return
    if (request.headers.get('sec-fetch-dest') !== 'document') return
    const seconds = pinSeconds(Number(process.env.NEXT_PUBLIC_BUILD_TIME), Date.now())
    if (seconds > 0) {
      response.cookies.set(PIN_COOKIE, deploymentId, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: seconds })
    } else if (request.cookies.get(PIN_COOKIE)) {
      response.cookies.delete(PIN_COOKIE)
    }
  }

  const withSession = (response: NextResponse) => {
    refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    keepVersion(response)
    return response
  }

  // Locale of the redirects below: the one in the path (/fr/login -> fr),
  // otherwise the language the visitor last chose (next-intl's NEXT_LOCALE
  // cookie), and only then the default. Without the cookie step, a signed-in
  // French user opening "/" was sent to the Spanish dashboard.
  const localeMatch = request.nextUrl.pathname.match(/^\/(es|fr|en)(\/|$)/)
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  const locale = localeMatch
    ? localeMatch[1]
    : routing.locales.find((l) => l === cookieLocale) ?? routing.defaultLocale

  // Check if it's an auth-related page
  const isAuthPage = request.nextUrl.pathname.endsWith('/login')

  const path = request.nextUrl.pathname
  // The public storefront (/boutique/{slug}) and the procurement intake
  // link (/procurement/{id}, filled in by an intermediary with no account)
  // and the landing page (/) are reachable without a session.
  const isRootOrLocaleOnly = path === '/' || /^\/(es|fr|en)\/?$/.test(path)
  const isBoutiqueOrProcurement = /^\/(es|fr|en)\/(boutique|procurement)(\/|$)/.test(path)

  const isPublicPage = isRootOrLocaleOnly || isBoutiqueOrProcurement
  const isLandingPage = isRootOrLocaleOnly

  // 2. Redirect logic
  // The home page for a visitor without a session is the WISHOP site
  // (static, public/landing). The first home page, built into the app, was
  // removed: typing the bare address used to show it instead.
  // One copy per language (scripts/landing-locales.mjs): same page, but the
  // <head> read by WhatsApp and Facebook link previews is in the visitor's
  // language — Spanish for the bare address, which link robots open.
  if (!user && isLandingPage) {
    return withSession(NextResponse.rewrite(new URL(`/landing/${locale}.html`, request.url)))
  }

  if (!user && !isAuthPage && !isPublicPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${locale}/login`
    return withSession(NextResponse.redirect(loginUrl))
  }

  // A signed-in visitor clicking "Créer ma boutique" (/login?mode=signup)
  // sees the form's "you are already signed in" choice instead of being
  // sent silently to their own shop.
  const isSignupForm = isAuthPage && request.nextUrl.searchParams.get('mode') === 'signup'

  if (user && (isAuthPage || isLandingPage) && !isSignupForm) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = `/${locale}/dashboard`
    return withSession(NextResponse.redirect(homeUrl))
  }

  // Per-employee page access: a MANAGER always has full access; a SELLER is
  // unrestricted until a manager explicitly configures allowed_pages for
  // them (empty array = unrestricted, see the migration comment).
  if (user && !isAuthPage && !isPublicPage) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('role, allowed_pages')
      .eq('id', user.id)
      .single()

    // A colleague holds the till with her code: her page access applies,
    // not the account's (features/offline, decided 26/09/2026).
    const holderId = await cashierFromCookie(request.cookies.get(CASHIER_COOKIE)?.value, user.id)
    if (holderId) {
      const { data: holder } = await supabase
        .from('profiles')
        .select('role, allowed_pages, is_active')
        .eq('id', holderId)
        .maybeSingle()
      if (holder?.is_active) profile = { role: holder.role, allowed_pages: holder.allowed_pages }
    }

    if (profile) {
      const pathWithoutLocale = request.nextUrl.pathname.replace(/^\/(es|fr|en)/, '') || '/'

      // An account beyond the plan's number of accounts is paused (never the
      // owner): it only sees the pause page, and gets back in on its own as
      // soon as the plan allows it (supabase: current_member_paused).
      const { data: paused } = await supabase.rpc('current_member_paused')
      const onPausedPage = pathWithoutLocale === '/paused'
      if (paused === true && !onPausedPage) {
        const pausedUrl = request.nextUrl.clone()
        pausedUrl.pathname = `/${locale}/paused`
        return withSession(NextResponse.redirect(pausedUrl))
      }
      if (paused !== true && onPausedPage) {
        const homeUrl = request.nextUrl.clone()
        homeUrl.pathname = `/${locale}/dashboard`
        return withSession(NextResponse.redirect(homeUrl))
      }

      const allowed = isPageAllowed(profile.role, profile.allowed_pages ?? [], pathWithoutLocale)
      if (!allowed) {
        const redirectUrl = request.nextUrl.clone()
        // The till first for an employee (decided 26/09/2026).
        redirectUrl.pathname = `/${locale}${firstOpenPath(profile.role, profile.allowed_pages ?? []) ?? firstAllowedPath(profile.allowed_pages ?? [])}`
        return withSession(NextResponse.redirect(redirectUrl))
      }
    }
  }

  // 3. Locale routing, built from the request that now carries the fresh session.
  return withSession(intlMiddleware(request))
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(es|fr|en)/:path*']
};

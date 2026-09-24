import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isPageAllowed, firstAllowedPath } from './lib/appPages';

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
  const withSession = (response: NextResponse) => {
    refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, allowed_pages')
      .eq('id', user.id)
      .single()

    if (profile) {
      const pathWithoutLocale = request.nextUrl.pathname.replace(/^\/(es|fr|en)/, '') || '/'
      const allowed = isPageAllowed(profile.role, profile.allowed_pages ?? [], pathWithoutLocale)
      if (!allowed) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = `/${locale}${firstAllowedPath(profile.allowed_pages ?? [])}`
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

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isPageAllowed, firstAllowedPath } from './lib/appPages';
 
const intlMiddleware = createMiddleware(routing);

// Next.js 16 renamed Middleware to Proxy (same behavior, new file name).
export async function proxy(request: NextRequest) {
  // 1. Run next-intl middleware
  const response = intlMiddleware(request);

  // 2. Setup Supabase client to refresh session and update cookies on the intl response
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Extract locale from pathname (e.g. /fr/login -> fr)
  const localeMatch = request.nextUrl.pathname.match(/^\/(es|fr|en)/)
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale
  
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

  // 3. Redirect logic
  if (!user && !isAuthPage && !isPublicPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${locale}/login`
    return NextResponse.redirect(loginUrl)
  }

  if (user && (isAuthPage || isLandingPage)) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(homeUrl)
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
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return response;
}
 
export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(es|fr|en)/:path*']
};

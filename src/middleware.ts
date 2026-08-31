import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
 
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
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
  const locale = localeMatch ? localeMatch[1] : 'es'
  
  // Check if it's an auth-related page
  const isAuthPage = request.nextUrl.pathname.endsWith('/login')

  // 3. Redirect logic
  if (!user && !isAuthPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${locale}/login`
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = `/${locale}/`
    return NextResponse.redirect(homeUrl)
  }

  return response;
}
 
export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(es|fr|en)/:path*']
};

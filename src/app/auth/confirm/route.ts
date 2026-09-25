import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { routing } from "@/i18n/routing";

// Where the sign-up confirmation email leads (emailRedirectTo, set by the
// signup action). The email is already confirmed by Supabase at this point;
// here the new owner is signed in and taken straight to her dashboard. If the
// session cannot be opened (link opened on another phone, or already used),
// she lands on the login page with a message saying the address is confirmed.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("locale");
  const locale = routing.locales.find((l) => l === requested) ?? routing.defaultLocale;
  const to = (path: string) => NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
  // Where the link leads once the session is open: the dashboard after a
  // sign-up, the new-password page after "Mot de passe oublié". Only these.
  const next = params.get("next") === "/reset-password" ? "/reset-password" : "/dashboard";

  const supabase = await createClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(next);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return to(next);
  }

  if (params.get("error")) return to("/login?error=confirmation_link_invalid");
  return to("/login?message=email_confirmed");
}

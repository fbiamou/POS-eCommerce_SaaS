import { getTranslations } from "next-intl/server";
import { KeyRound } from "lucide-react";
import { WishopMark } from "@/components/brand/WishopMark";
import { PasswordField } from "@/components/PasswordField";
import { readFeedbackParam } from "@/lib/feedback";
import { updatePassword } from "../login/actions";

export async function generateMetadata() {
  const t = await getTranslations("Auth");
  return { title: t("new_password_heading") };
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-3 text-[15px] font-medium transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]";

// Reached from the "Mot de passe oublié" email (through /auth/confirm, which
// has signed the owner in): she chooses a new password, with the same rules
// as at sign-up.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [t, tFeedback, params] = await Promise.all([getTranslations("Auth"), getTranslations("Feedback"), searchParams]);
  const error = readFeedbackParam(params.error);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-2xl bg-[var(--surface-1)] p-6 shadow-card">
        <div className="flex items-center gap-2 text-night dark:text-white">
          <WishopMark className="h-6 w-auto" />
          <span className="font-display text-[19px] font-extrabold tracking-tight">{t("title")}</span>
        </div>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-1 h-6 w-6 shrink-0 text-violet-600" />
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-tight">{t("new_password_heading")}</h1>
            <p className="mt-1 text-[14px] text-zinc-500">{t("new_password_sub")}</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-[14px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {tFeedback(error)}
          </p>
        )}
        <form action={updatePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="password">{t("password")}</label>
            <PasswordField id="password" name="password" inputClassName={inputClass} />
          </div>
          <button type="submit" className="w-full rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-violet-700">
            {t("new_password_save")}
          </button>
        </form>
      </div>
    </main>
  );
}

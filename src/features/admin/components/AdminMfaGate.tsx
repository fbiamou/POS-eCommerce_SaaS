"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/client";

type Step =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "challenge"; factorId: string }
  | { kind: "unavailable" };

// Second factor of the WISHOP console (migration admin_mfa). The first time,
// the admin links an authenticator app (QR code or key) and confirms with a
// code; afterwards the console asks for the code once per session. Supabase
// Auth keeps the factor; the session then reaches "aal2", which the database
// requires for every console function.
export function AdminMfaGate() {
  const t = useTranslations("AdminMfa");
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<"wrong" | "failed" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError || !data) {
        setStep({ kind: "unavailable" });
        return;
      }
      const verified = data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setStep({ kind: "challenge", factorId: verified.id });
        return;
      }
      // An app linked halfway (page closed before the code) is started again.
      for (const factor of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "WISHOP" });
      if (cancelled) return;
      if (enrollError || !enrolled) {
        setStep({ kind: "unavailable" });
        return;
      }
      setStep({ kind: "enroll", factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step.kind !== "enroll" && step.kind !== "challenge") return;
    if (!/^[0-9]{6}$/.test(code)) {
      setError("wrong");
      return;
    }
    setChecking(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code });
    setChecking(false);
    if (verifyError) {
      setError(verifyError.status === 422 || /code/i.test(verifyError.message) ? "wrong" : "failed");
      setCode("");
      return;
    }
    router.refresh();
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-[var(--surface-1)] p-6 shadow-card">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 shrink-0 text-violet-600" />
        <h1 className="text-lg font-bold">{step.kind === "enroll" ? t("enroll_title") : t("challenge_title")}</h1>
      </div>

      {step.kind === "loading" && <p className="text-[14px] text-zinc-500">{t("loading")}</p>}
      {step.kind === "unavailable" && <p className="text-[14px] font-semibold text-red-600">{t("unavailable")}</p>}

      {step.kind === "enroll" && (
        <>
          <p className="text-[14px] text-zinc-600 dark:text-zinc-300">{t("enroll_intro")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code given by Supabase as an SVG data URL */}
          <img src={step.qrCode} alt={t("qr_alt")} width={180} height={180} className="mx-auto rounded-xl bg-white p-2" />
          <p className="text-[13px] text-zinc-500">
            {t("secret_label")} <span className="break-all font-mono text-zinc-800 dark:text-zinc-200">{step.secret}</span>
          </p>
        </>
      )}
      {step.kind === "challenge" && <p className="text-[14px] text-zinc-600 dark:text-zinc-300">{t("challenge_intro")}</p>}

      {(step.kind === "enroll" || step.kind === "challenge") && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("code_label")}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em] dark:border-zinc-700 dark:bg-[var(--surface-2)]"
            />
          </label>
          <p role="alert" className="min-h-5 text-[13px] font-semibold text-red-600">
            {error === "wrong" ? t("wrong_code") : error === "failed" ? t("failed") : ""}
          </p>
          <button
            type="submit"
            disabled={checking || code.length !== 6}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {step.kind === "enroll" ? t("enroll_button") : t("challenge_button")}
          </button>
        </form>
      )}
    </div>
  );
}

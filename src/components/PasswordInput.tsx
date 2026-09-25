"use client";

import { useState, type InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

// A password field with an eye to show what was typed before sending it,
// so a typo on a phone keyboard does not lock the owner out.
export function PasswordInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("Validation");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("password_hide") : t("password_show")}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

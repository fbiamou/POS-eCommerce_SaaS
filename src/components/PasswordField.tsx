"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES, passwordIssues } from "@/lib/password";

// A new password with its five rules shown as they are met, instead of a
// form that only says "invalid" after the fact.
export function PasswordField({ id, name, inputClassName }: { id: string; name: string; inputClassName: string }) {
  const t = useTranslations("Validation");
  const [value, setValue] = useState("");
  const issues = passwordIssues(value);

  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        name={name}
        type="password"
        autoComplete="new-password"
        required
        data-own-validity="true"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const missing = passwordIssues(e.target.value);
          e.target.setCustomValidity(missing.length > 0 ? t("password_weak") : "");
        }}
        onInvalid={(e) => {
          if (passwordIssues(e.currentTarget.value).length > 0) e.currentTarget.setCustomValidity(t("password_weak"));
        }}
        aria-describedby={`${id}-rules`}
        className={inputClassName}
      />
      <ul id={`${id}-rules`} className="grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = value.length > 0 && !issues.includes(rule);
          return (
            <li key={rule} className={`flex items-center gap-1.5 ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>
              {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              {t(`password_rule_${rule}`, { min: PASSWORD_MIN_LENGTH })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

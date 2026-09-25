import { getTranslations } from "next-intl/server";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { FirstStep } from "../steps";

// "Premiers pas": what a new shop does first, ticked from its real data.
// Honest about the effort: entering the stock is the long part.
export async function FirstSteps({ steps }: { steps: FirstStep[] }) {
  const t = await getTranslations("Dashboard");
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section aria-labelledby="first-steps-t" className="rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="first-steps-t" className="text-lg font-bold">{t("first_steps_title")}</h2>
        <span className="font-mono text-[13px] text-zinc-500 tabular-nums">
          {t("first_steps_progress", { done, total: required.length })}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {required.map((step) => (
          <span key={step.key} className={`h-1.5 flex-1 rounded-full ${step.done ? "bg-violet-600" : "bg-zinc-200 dark:bg-[var(--surface-3)]"}`} />
        ))}
      </div>
      <ol className="mt-4 divide-y divide-zinc-200 dark:divide-[var(--line)]">
        {steps.map((step, index) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex items-center gap-3 py-3 ${step.done ? "opacity-60" : ""} ${step === next ? "font-semibold" : ""}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  step.done
                    ? "bg-emerald-600 text-white"
                    : step === next
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-600 dark:bg-[var(--surface-2)] dark:text-zinc-300"
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14.5px] ${step.done ? "line-through" : ""}`}>
                  {t(`step_${step.key}`)}
                  {step.optional && <span className="ml-2 text-[12px] font-normal text-zinc-500">{t("step_optional")}</span>}
                </span>
                {!step.done && <span className="block text-[12.5px] font-normal text-zinc-500">{t(`step_${step.key}_hint`)}</span>}
              </span>
              {!step.done && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

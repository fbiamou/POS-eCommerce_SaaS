// How much of a debt is repaid, drawn with the WISHOP thread: an indigo line
// that fills as payments come in, with the saffron lozenge marking where the
// customer stands. Green once everything is paid (green means "paid").
export function DebtProgress({
  paid,
  total,
  label,
  className = "",
}: {
  paid: number;
  total: number;
  /** Translated caption, e.g. "7 900 FCFA payés sur 23 700 FCFA". */
  label?: string;
  className?: string;
}) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 1;
  const done = ratio >= 1;
  const percent = Math.round(ratio * 100);

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className="relative h-2.5 rounded-full bg-zinc-200 dark:bg-[var(--surface-3)]"
      >
        <div
          className={`h-full rounded-full ${done ? "bg-emerald-600" : "bg-violet-600"}`}
          style={{ width: `${percent}%` }}
        />
        {!done && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] bg-saffron ring-2 ring-[var(--surface-1)]"
            style={{ left: `${percent}%` }}
          />
        )}
      </div>
      {label && <p className="mt-1.5 text-[12.5px] text-zinc-500">{label}</p>}
    </div>
  );
}

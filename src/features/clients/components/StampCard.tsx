// The stamp card drawn with the WISHOP lozenge: a saffron lozenge per stamp,
// an outlined one per stamp still to earn. Server- and client-safe.
export function StampDots({
  stamps,
  required,
  label,
  size = "md",
}: {
  stamps: number;
  required: number;
  /** Translated text for screen readers, e.g. "7 tampons sur 10". */
  label: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <span role="img" aria-label={label} className="inline-flex flex-wrap items-center gap-1.5">
      {Array.from({ length: required }, (_, i) => (
        <span
          key={i}
          className={`${box} rotate-45 rounded-[2px] ${
            i < stamps ? "bg-saffron" : "shadow-[inset_0_0_0_1.5px_var(--color-zinc-300)]"
          }`}
        />
      ))}
    </span>
  );
}

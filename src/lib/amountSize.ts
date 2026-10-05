// A long amount ("10 160 800 FCFA") overflowed the half-width cards of the
// phone layout. Below the sm breakpoint, its font shrinks with its length;
// wider screens keep the card's own size.
export function amountSize(text: string): string {
  const length = text.length;
  if (length <= 11) return "";
  if (length <= 14) return "max-sm:text-[15px]";
  if (length <= 16) return "max-sm:text-[13px]";
  return "max-sm:text-[12px] [overflow-wrap:anywhere]";
}

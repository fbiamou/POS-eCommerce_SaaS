// Extracts the VAT amount embedded in a VAT-inclusive total, rounded so that
// (excludingVat + vatAmount) always sums back exactly to totalAmount.
export function extractVat(totalAmount: number, vatRateBps: number) {
  const excludingVat = Math.round((totalAmount * 10000) / (10000 + vatRateBps));
  const vatAmount = totalAmount - excludingVat;
  return { excludingVat, vatAmount };
}

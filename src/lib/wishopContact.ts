// How a shop reaches WISHOP to pay for a plan, until a payment aggregator
// exists (Muni Dinero, bank transfer or cash, then the plan is activated in
// the admin console).
export const WISHOP_PAYMENT_WHATSAPP = "+240 222 779 813";

export function wishopWhatsAppUrl(message: string): string {
  return `https://wa.me/${WISHOP_PAYMENT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

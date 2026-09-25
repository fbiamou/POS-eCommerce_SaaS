// Server actions never return user-facing text: they return one of these
// codes, and the interface translates it with the "Feedback" namespace of
// messages/*.json. This keeps every visible sentence in the translation files
// (AGENTS.md) and lets a Spanish or English user read errors in their language.

export const FEEDBACK_CODES = [
  // Generic
  "generic_error",
  "unauthorized",
  "access_denied",
  "shop_not_found",
  "update_failed",
  "required_fields_missing",
  // Database functions (raised by the RPCs, see supabase/migrations)
  "unauthorized_shop",
  "empty_cart",
  "invalid_amount",
  "invalid_quantity",
  "invalid_price",
  "client_not_found",
  "product_not_found",
  "insufficient_stock",
  "invoice_not_found",
  "invoice_already_paid",
  "payment_exceeds_balance",
  // Auth
  "invalid_credentials",
  "signup_failed",
  "signup_check_email",
  "terms_required",
  "password_weak",
  "email_taken",
  "email_invalid_signup",
  "signup_rate_limited",
  "email_send_failed",
  "reset_email_sent",
  "password_updated",
  "email_confirmed",
  "confirmation_link_invalid",
  // Settings
  "name_required",
  "profile_updated",
  "shop_profile_updated",
  "appearance_updated",
  "no_file_selected",
  "logo_upload_failed",
  "logo_saved_update_failed",
  "logo_updated",
  "slug_empty",
  "slug_invalid",
  "slug_taken",
  "delays_invalid",
  "threshold_invalid",
  // Team
  "employee_name_password_required",
  "service_role_missing",
  "employee_create_failed",
  "employee_profile_failed",
  "employee_added",
  "employee_added_with_login",
  "self_action_forbidden",
  "member_not_found",
  "suspend_failed",
  "reactivate_failed",
  "status_update_failed",
  "role_update_failed",
  "access_update_failed",
  "password_reset_failed",
  // Stock
  "product_save_failed",
  "product_update_failed",
  "stock_adjust_failed",
  "image_upload_failed",
  "image_saved_update_failed",
  "csv_file_missing",
  "csv_invalid",
  // Clients
  "client_save_failed",
  // Reminders
  "reminder_failed",
  // Shipments and purchase orders
  "shipment_not_found",
  "shipment_already_submitted",
  "shipment_not_in_transit",
  "photo_required",
  "too_many_items",
  "missing_received_quantity",
  "purchase_order_not_found",
  "purchase_order_not_editable",
  "invalid_status_change",
  "purchase_order_has_shipment",
  "purchase_order_not_deletable",
  // Platform admin console
  "admin_invalid",
  "shop_has_payments",
  "shop_has_admin",
  "delete_name_mismatch",
  // Plans
  "shop_read_only",
  "plan_feature_locked",
  "plan_credit_locked",
  "plan_limit_items",
  "plan_limit_accounts",
  // Loyalty
  "loyalty_reward_unavailable",
  "loyalty_invalid",
  // Storefront reports
  "report_invalid",
  "report_rate_limited",
  // Offline mode: tills numbered per device (register_device, record_sale)
  "device_not_found",
  "device_sequence_missing",
  "device_sequence_conflict",
  "device_not_ready",
  "needs_connection",
  // Till codes (set_member_pin)
  "pin_invalid",
] as const;

export type FeedbackCode = (typeof FEEDBACK_CODES)[number];

export function isFeedbackCode(value: unknown): value is FeedbackCode {
  return typeof value === "string" && (FEEDBACK_CODES as readonly string[]).includes(value);
}

// Turns a Supabase/RPC error into a feedback code. Functions updated since
// the 23/09/2026 audit raise codes directly ('insufficient_stock'...); the
// older ones raise English sentences, mapped here.
export function feedbackFromError(error: { message?: string } | null | undefined): FeedbackCode {
  const message = error?.message?.trim() ?? "";
  if (isFeedbackCode(message)) return message;
  if (message === "Unauthorized shop access") return "unauthorized_shop";
  if (message.startsWith("Not enough stock")) return "insufficient_stock";
  if (message.startsWith("Product") && message.includes("not found")) return "product_not_found";
  if (message.startsWith("Quantity cannot be negative") || message.startsWith("Restock quantity")) return "invalid_quantity";
  // place_online_order (public storefront)
  if (message.includes("is not available")) return "product_not_found";
  if (message.startsWith("Invalid quantity")) return "invalid_quantity";
  if (message === "Cart is empty") return "empty_cart";
  if (message.startsWith("Customer name") || message.startsWith("Customer phone")) return "required_fields_missing";
  return "generic_error";
}

// Query-string feedback (?error=... / ?message=...) is only ever rendered if
// it is a known code: a crafted link cannot make the page display arbitrary text.
export function readFeedbackParam(value: string | undefined): FeedbackCode | null {
  return isFeedbackCode(value) ? value : null;
}

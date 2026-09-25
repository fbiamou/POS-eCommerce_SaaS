"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// The browser writes its form bubbles ("Please fill out this field",
// "Veuillez cocher cette case...") in the BROWSER's language, whatever the
// page's. Mounted once for every page, this replaces their text with ours,
// in the page's language, so a Spanish-speaking owner is never blocked by a
// French or English message.
export function NativeValidationMessages() {
  const t = useTranslations("Validation");

  useEffect(() => {
    const onInvalid = (event: Event) => {
      const field = event.target as Field;
      if (!("validity" in field)) return;
      const v = field.validity;
      let message = "";
      if (v.valueMissing) {
        message = field instanceof HTMLInputElement && field.type === "checkbox" ? t("checkbox_required") : t("required");
      } else if (v.typeMismatch && field instanceof HTMLInputElement && field.type === "email") {
        message = t("email_invalid");
      } else if (v.tooShort && "minLength" in field) {
        message = t("too_short", { min: field.minLength });
      } else if (v.rangeUnderflow && field instanceof HTMLInputElement) {
        message = t("min_value", { min: field.min });
      } else if (v.rangeOverflow && field instanceof HTMLInputElement) {
        message = t("max_value", { max: field.max });
      } else if (v.stepMismatch || v.badInput) {
        message = t("number_invalid");
      } else if (v.patternMismatch || v.typeMismatch) {
        message = t("format_invalid");
      }
      // A message a component set itself (e.g. the password rules) is kept.
      if (message && !(v.customError && field.validationMessage)) field.setCustomValidity(message);
    };
    // Once the field changes, the browser judges it afresh.
    const onEdit = (event: Event) => {
      const field = event.target as Field;
      if ("setCustomValidity" in field && !field.dataset.ownValidity) field.setCustomValidity("");
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, [t]);

  return null;
}

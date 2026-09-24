"use client";

import { useTranslations } from "next-intl";
import { Modal } from "./Modal";

// The app's own "are you sure?" step, instead of window.confirm() which
// looks foreign on a phone and cannot be styled.
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  tone = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Common");
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-5">
        {children && <div className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-5 py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 sm:py-2.5"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-xl px-5 py-3 text-[14px] font-bold text-white disabled:opacity-50 sm:py-2.5 ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

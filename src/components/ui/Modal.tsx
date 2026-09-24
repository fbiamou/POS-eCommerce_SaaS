"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

// A native <dialog>. On phones it opens as a bottom sheet (thumb reach, full
// width); from the sm breakpoint up it is a centred card.
export function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Common");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      // Escape closes a native dialog on its own; route it through onClose so
      // the parent's state follows, otherwise the dialog could never reopen.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl border-0 bg-[var(--surface-1)] p-0 text-foreground shadow-2xl backdrop:bg-[#141C45]/55 backdrop:backdrop-blur-[2px] open:flex sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-[var(--line)]">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}

"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle } from "lucide-react";

// A short confirmation shown at the bottom of the screen, above the phone tab
// bar. Replaces window.alert(), which blocks the page and looks foreign on a
// phone. Callers pass an already translated message.
type ToastTone = "success" | "error";
type ToastState = {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: "success",
  show: (message, tone = "success") => {
    if (timer) clearTimeout(timer);
    set({ message, tone });
    timer = setTimeout(() => set({ message: null }), tone === "error" ? 6000 : 3500);
  },
  hide: () => set({ message: null }),
}));

export function Toaster() {
  const { message, tone, hide } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-8"
    >
      {message && (
        <button
          type="button"
          onClick={hide}
          className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-left text-[14px] font-semibold shadow-[0_14px_30px_-12px_rgba(20,28,69,0.6)] ${
            tone === "success" ? "bg-night text-white dark:bg-[var(--surface-3)]" : "bg-red-600 text-white"
          }`}
        >
          {tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-saffron" />
          ) : (
            <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
          )}
          <span>{message}</span>
        </button>
      )}
    </div>
  );
}

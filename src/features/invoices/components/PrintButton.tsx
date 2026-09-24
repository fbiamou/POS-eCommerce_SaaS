"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-violet-700"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}

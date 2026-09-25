"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { logout } from "@/app/[locale]/login/actions";

export function PausedLogout({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await logout();
        router.replace("/login");
      }}
      className="rounded-xl bg-zinc-100 px-5 py-3 text-[14px] font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:bg-white/10 dark:text-white"
    >
      {label}
    </button>
  );
}

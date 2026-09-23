"use client";

import { useState, useTransition } from "react";
import { UserCircle, Ban, RotateCcw, KeyRound, Copy, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedbackCode } from "@/lib/feedback";
import {
  suspendTeamMember,
  reactivateTeamMember,
  updateTeamMemberRole,
  updateTeamMemberAllowedPages,
  resetTeamMemberPassword,
} from "../actions";
import type { Profile } from "@/features/auth/actions";
import { APP_PAGES, type AppPageKey } from "@/lib/appPages";

const ROLE_STYLES: Record<string, string> = {
  MANAGER: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  SELLER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

export function TeamMemberRow({
  member,
  isSelf,
  roleLabels,
}: {
  member: Profile;
  isSelf: boolean;
  roleLabels: { MANAGER: string; SELLER: string };
}) {
  const t = useTranslations("Settings");
  const tFeedback = useTranslations("Feedback");
  const tSidebar = useTranslations("Sidebar");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<AppPageKey>>(
    new Set((member.allowed_pages ?? []) as AppPageKey[])
  );

  const togglePage = (key: AppPageKey) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveAccess = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTeamMemberAllowedPages(member.id, Array.from(selectedPages));
      if (result.error) setError(result.error);
      else setShowAccess(false);
    });
  };

  const handleRoleChange = (role: "MANAGER" | "SELLER") => {
    setError(null);
    startTransition(async () => {
      const result = await updateTeamMemberRole(member.id, role);
      if (result.error) setError(result.error);
    });
  };

  const handleToggleActive = () => {
    setError(null);
    startTransition(async () => {
      const action = member.is_active ? suspendTeamMember : reactivateTeamMember;
      const result = await action(member.id);
      if (result.error) setError(result.error);
    });
  };

  const handleResetPassword = () => {
    setError(null);
    if (!confirm(t("confirm_reset_password"))) return;
    startTransition(async () => {
      const result = await resetTeamMemberPassword(member.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.newPassword) setRevealedPassword(result.newPassword);
    });
  };

  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
          <UserCircle className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {member.full_name || t("no_name")}
            {isSelf && <span className="ml-2 text-xs text-zinc-400">({t("you")})</span>}
          </p>
          {!member.is_active && (
            <span className="text-xs font-medium text-red-500">{t("suspended")}</span>
          )}
        </div>

        {isSelf ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLES[member.role]}`}
          >
            {roleLabels[member.role]}
          </span>
        ) : (
          <>
            <select
              value={member.role}
              disabled={isPending}
              onChange={(e) => handleRoleChange(e.target.value as "MANAGER" | "SELLER")}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="SELLER">{roleLabels.SELLER}</option>
              <option value="MANAGER">{roleLabels.MANAGER}</option>
            </select>

            {member.role === "SELLER" && (
              <button
                type="button"
                onClick={() => setShowAccess((v) => !v)}
                disabled={isPending}
                title={t("manage_access")}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isPending}
              title={t("reset_password")}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              title={member.is_active ? t("suspend") : t("reactivate")}
              className={`rounded-md p-1.5 disabled:opacity-50 ${
                member.is_active
                  ? "text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  : "text-green-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
              }`}
            >
              {member.is_active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{tFeedback(error)}</p>}

      {showAccess && member.role === "SELLER" && (
        <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-3">
          <p className="text-xs text-zinc-400 mb-2">
            {selectedPages.size === 0 ? t("access_unrestricted") : t("employee_access_hint")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {APP_PAGES.map((page) => (
              <label key={page.key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedPages.has(page.key)}
                  onChange={() => togglePage(page.key)}
                  className="rounded"
                />
                {tSidebar(page.key)}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAccess(false)}
              className="rounded-md px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSaveAccess}
              disabled={isPending}
              className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {t("save_access")}
            </button>
          </div>
        </div>
      )}

      {revealedPassword && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-800 dark:text-amber-300">
          <span>{t("new_password_label")}:</span>
          <code className="rounded bg-white dark:bg-zinc-900 px-2 py-0.5 font-mono">{revealedPassword}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(revealedPassword)}
            className="ml-auto rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title={t("copy")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRevealedPassword(null)}
            className="text-amber-600 hover:underline"
          >
            {t("dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}

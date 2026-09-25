"use client";

import { useState, useTransition } from "react";
import { UserCircle, Ban, RotateCcw, KeyRound, Copy, ShieldCheck, Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedbackCode } from "@/lib/feedback";
import {
  suspendTeamMember,
  reactivateTeamMember,
  updateTeamMemberRole,
  updateTeamMemberAllowedPages,
  resetTeamMemberPassword,
  setTeamMemberPin,
} from "../actions";
import { Modal } from "@/components/ui/Modal";
import type { Profile } from "@/features/auth/actions";
import { APP_PAGES, type AppPageKey } from "@/lib/appPages";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ROLE_STYLES: Record<string, string> = {
  MANAGER: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  SELLER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

export function TeamMemberRow({
  member,
  isSelf,
  roleLabels,
  paused = false,
  canManageAccess = true,
}: {
  member: Profile;
  isSelf: boolean;
  roleLabels: { MANAGER: string; SELLER: string };
  /** Beyond the plan's number of accounts (see pausedMemberIds). */
  paused?: boolean;
  /** Page-by-page access comes with the Pro plan. */
  canManageAccess?: boolean;
}) {
  const t = useTranslations("Settings");
  const tFeedback = useTranslations("Feedback");
  const tSidebar = useTranslations("Sidebar");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const tCashier = useTranslations("Cashier");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<FeedbackCode | null>(null);

  const savePin = (value: string | null) => {
    setPinError(null);
    startTransition(async () => {
      const result = await setTeamMemberPin(member.id, value);
      if (result.error) {
        setPinError(result.error);
        return;
      }
      setPinOpen(false);
      setPin("");
    });
  };

  const pinButton = (
    <button
      type="button"
      onClick={() => {
        setPin("");
        setPinError(null);
        setPinOpen(true);
      }}
      disabled={isPending}
      title={tCashier("pin_button")}
      className={`rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 ${
        member.has_pin ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      }`}
    >
      <Hash className="h-4 w-4" />
      <span className="sr-only">{member.has_pin ? tCashier("pin_set") : tCashier("pin_button")}</span>
    </button>
  );
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
    setConfirmReset(false);
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
          {member.is_active && paused && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("member_paused")}</span>
          )}
        </div>

        {isSelf ? (
          <>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLES[member.role]}`}
            >
              {roleLabels[member.role]}
            </span>
            {pinButton}
          </>
        ) : (
          <>
            <Select
              value={member.role}
              disabled={isPending}
              onChange={(v) => handleRoleChange(v as "MANAGER" | "SELLER")}
              className="w-40"
              triggerClassName="py-1.5 text-[13px]"
              options={[
                { value: "SELLER", label: roleLabels.SELLER },
                { value: "MANAGER", label: roleLabels.MANAGER },
              ]}
            />

            {member.role === "SELLER" && canManageAccess && (
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

            {pinButton}

            <button
              type="button"
              onClick={() => setConfirmReset(true)}
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

      <Modal isOpen={pinOpen} onClose={() => setPinOpen(false)} title={tCashier("pin_title", { name: member.full_name || t("no_name") })}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            savePin(pin);
          }}
          className="flex flex-col gap-4 text-[14px]"
        >
          <p className="text-zinc-600 dark:text-zinc-300">{tCashier("pin_intro")}</p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            aria-label={tCashier("pin_button")}
            className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] dark:border-[var(--line)]"
          />
          {pinError && <p className="text-sm font-medium text-red-600">{tFeedback(pinError)}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            {member.has_pin ? (
              <button type="button" onClick={() => savePin(null)} disabled={isPending} className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20">
                {tCashier("pin_remove")}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" disabled={isPending || pin.length !== 4} className="rounded-xl bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {tCashier("pin_save")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmReset}
        title={t("reset_password")}
        confirmLabel={t("reset_password")}
        tone="danger"
        pending={isPending}
        onConfirm={handleResetPassword}
        onCancel={() => setConfirmReset(false)}
      >
        {t("confirm_reset_password")}
      </ConfirmDialog>
    </div>
  );
}

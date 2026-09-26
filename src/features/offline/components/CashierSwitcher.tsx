"use client";

import { useState } from "react";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { useTranslations } from "next-intl";
import { useLiveQuery } from "dexie-react-hooks";
import { Delete, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useOptionalOfflineContext } from "../OfflineProvider";
import { PIN_LENGTH, pinMatches, readCashierDay, shopDay, writeCashierDay } from "../pin";
import type { LocalMember } from "../db";

// "Sale in the name of Awa · Switch": on a device shared by the shop, the
// person selling types their 4-digit till code, and the sales and payments
// taken on this device are recorded in their name, even offline (decided
// 25/09/2026, like Loyverse). The signed-in account does not change.
// The till asks on its own at its first opening of the day on the device,
// and again at each opening until someone answers (decided 26/09/2026).
export function CashierSwitcher() {
  const offline = useOptionalOfflineContext();
  const t = useTranslations("Cashier");
  const format = useShopFormat();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [answeredDay, setAnsweredDay] = useState(() =>
    typeof window === "undefined" || !offline ? null : readCashierDay(window.localStorage, offline.shopId)
  );
  const today = shopDay(new Date(), format.timeZone);
  const teamSize = useLiveQuery(
    async () => (offline ? (await offline.db.members.toArray()).filter((m) => m.is_active).length : 0),
    [offline?.db],
    0
  );
  // A shop run by one person has nobody to switch with.
  if (!offline || teamSize < 2) return null;

  const askToday = answeredDay !== today && !dismissed;
  const answered = () => {
    writeCashierDay(window.localStorage, offline.shopId, today);
    setAnsweredDay(today);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-0 items-center gap-2 rounded-full bg-[var(--surface-1)] px-3 py-1.5 text-[13px] shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:hover:bg-[var(--surface-2)]"
      >
        <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="truncate text-zinc-600 dark:text-zinc-300">
          {t("selling_as")} <span className="font-semibold text-zinc-900 dark:text-white">{offline.cashier.name || t("no_name")}</span>
        </span>
        <span className="shrink-0 font-semibold text-violet-700 dark:text-violet-300">{t("switch")}</span>
      </button>
      {(open || askToday) && (
        <CashierPanel
          onClose={() => {
            setOpen(false);
            setDismissed(true);
          }}
          onChosen={answered}
        />
      )}
    </>
  );
}

function CashierPanel({ onClose, onChosen }: { onClose: () => void; onChosen: () => void }) {
  const offline = useOptionalOfflineContext()!;
  const t = useTranslations("Cashier");
  const members = useLiveQuery(
    async () => (await offline.db.members.toArray()).filter((m) => m.is_active).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    [offline.db],
    [] as LocalMember[]
  );
  const [chosen, setChosen] = useState<LocalMember | null>(null);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);

  const choose = (member: LocalMember) => {
    // The signed-in account without a code takes the till back directly.
    if (member.id === offline.userId && !member.pin_hash) {
      offline.setCashier({ id: member.id, name: member.full_name });
      onChosen();
      onClose();
      return;
    }
    setChosen(member);
    setCode("");
    setWrong(false);
  };

  const press = async (digit: string) => {
    if (!chosen || checking) return;
    const next = (code + digit).slice(0, PIN_LENGTH);
    setCode(next);
    setWrong(false);
    if (next.length < PIN_LENGTH) return;
    setChecking(true);
    const ok = await pinMatches(next, chosen.pin_salt, chosen.pin_hash);
    setChecking(false);
    if (ok) {
      offline.setCashier({ id: chosen.id, name: chosen.full_name });
      onChosen();
      onClose();
    } else {
      setWrong(true);
      setCode("");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={chosen ? t("code_of", { name: chosen.full_name || t("no_name") }) : t("title")}>
      {!chosen ? (
        <div className="flex flex-col gap-3 text-[14px]">
          <p className="text-zinc-600 dark:text-zinc-300">{t("intro")}</p>
          {members.length === 0 && <p className="text-zinc-500">{t("no_members")}</p>}
          <ul className="flex flex-col gap-2">
            {members.map((member) => {
              const usable = Boolean(member.pin_hash) || member.id === offline.userId;
              const current = member.id === offline.cashier.id;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => choose(member)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left disabled:opacity-50 ${
                      current ? "bg-violet-50 ring-2 ring-violet-500 dark:bg-violet-900/20" : "bg-zinc-50 hover:bg-zinc-100 dark:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="font-semibold">{member.full_name || t("no_name")}</span>
                    {!usable && <span className="text-[12px] text-zinc-500">{t("no_pin")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[12.5px] text-zinc-500">{t("no_pin_hint")}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3" aria-label={t("code_of", { name: chosen.full_name || t("no_name") })}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span key={i} className={`h-4 w-4 rounded-full ${i < code.length ? "bg-night dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"}`} />
            ))}
          </div>
          <p role="alert" className="h-5 text-[13px] font-semibold text-red-600">{wrong ? t("wrong_pin") : ""}</p>
          <div className="grid w-full max-w-[260px] grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button key={digit} type="button" onClick={() => void press(digit)} className="rounded-2xl bg-zinc-100 py-4 font-mono text-xl font-semibold hover:bg-zinc-200 dark:bg-[var(--surface-2)]">
                {digit}
              </button>
            ))}
            <button type="button" onClick={() => setChosen(null)} className="rounded-2xl py-4 text-[13px] font-semibold text-zinc-600 dark:text-zinc-300">
              {t("back")}
            </button>
            <button type="button" onClick={() => void press("0")} className="rounded-2xl bg-zinc-100 py-4 font-mono text-xl font-semibold hover:bg-zinc-200 dark:bg-[var(--surface-2)]">
              0
            </button>
            <button type="button" onClick={() => setCode(code.slice(0, -1))} aria-label={t("delete")} className="flex items-center justify-center rounded-2xl py-4 text-zinc-600 dark:text-zinc-300">
              <Delete className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useState, useTransition } from "react";
import { UserPlus, Star, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { PHONE_COUNTRY_CODES } from "@/lib/phoneCountryCodes";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { addClient, updateClient } from "../actions";
import { useOptionalOfflineContext } from "@/features/offline/OfflineProvider";
import { addClientAnywhere } from "@/features/offline/localActions";
import { useToast } from "@/components/ui/Toast";
import { getInitials } from "@/components/layout/ShopAvatar";
import { LOYALTY_MIN_PURCHASES } from "../stats";
import type { LoyaltyCard } from "../loyalty";
import { StampDots } from "./StampCard";

export type ClientData = {
  id: string;
  name: string;
  phone: string | null;
  total_purchases: number;
  recent_purchases: number;
  total_spent: number;
  total_debt: number;
  first_purchase_date: string | null;
  is_loyal: boolean;
  card?: LoyaltyCard;
};

// Existing clients created before the country-code selector existed may have
// a bare local number with no dial code — fall back to the shop's default
// rather than guessing wrong.
function splitPhone(phone: string | null | undefined, fallbackCode: string): { code: string; digits: string } {
  if (!phone) return { code: fallbackCode, digits: "" };
  const match = PHONE_COUNTRY_CODES.find((c) => phone.startsWith(c.code));
  if (match) return { code: match.code, digits: phone.slice(match.code.length) };
  return { code: fallbackCode, digits: phone.replace(/\D/g, "") };
}

export default function ClientList({
  clients,
  defaultPhoneCountryCode = "+237",
  loyaltyEnabled = false,
}: {
  clients: ClientData[];
  defaultPhoneCountryCode?: string;
  loyaltyEnabled?: boolean;
}) {
  const t = useTranslations("Clients");
  const showToast = useToast((state) => state.show);
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const offline = useOptionalOfflineContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "debt" | "loyal">("all");
  const [isPending, startTransition] = useTransition();

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCountryCode, setNewCountryCode] = useState(defaultPhoneCountryCode);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCountryCode, setEditCountryCode] = useState(defaultPhoneCountryCode);
  const [editError, setEditError] = useState<string | null>(null);

  // A client may have no phone number: searching must not crash on it.
  const term = searchTerm.trim().toLowerCase();
  const filteredClients = clients.filter(
    (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term)
  );

  const closeNewClientModal = () => {
    setIsNewClientModalOpen(false);
    setNewName("");
    setNewPhone("");
    setNewCountryCode(defaultPhoneCountryCode);
    setCreateError(null);
  };

  const handleNewClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    startTransition(async () => {
      // Offline mode: created online, or kept on the device and sent later.
      if (offline) {
        const digits = newPhone.replace(/\D/g, "");
        const created = await addClientAnywhere(offline, newName, digits ? `${newCountryCode}${digits}` : null);
        if (!created.ok) {
          setCreateError(tFeedback(created.code));
          return;
        }
        showToast(t("new_client_success"));
        closeNewClientModal();
        return;
      }
      const formData = new FormData();
      formData.set("name", newName);
      formData.set("phone", newPhone);
      formData.set("phone_country_code", newCountryCode);
      const result = await addClient(formData);
      if (result.error) {
        setCreateError(tFeedback(result.error));
        return;
      }
      showToast(t("new_client_success"));
      closeNewClientModal();
    });
  };

  const openEditModal = (client: ClientData) => {
    const { code, digits } = splitPhone(client.phone, defaultPhoneCountryCode);
    setEditingClient(client);
    setEditName(client.name);
    setEditPhone(digits);
    setEditCountryCode(code);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingClient(null);
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEditError(null);
    // Changing a customer's card is done online only (for now).
    if (offline && !offline.status.online) {
      setEditError(tFeedback("needs_connection"));
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", editName);
      formData.set("phone", editPhone);
      formData.set("phone_country_code", editCountryCode);
      const result = await updateClient(editingClient.id, formData);
      if (result.error) {
        setEditError(tFeedback(result.error));
        return;
      }
      closeEditModal();
    });
  };

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-night text-white dark:bg-violet-500"
        : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;
  const debtorCount = clients.filter((c) => c.total_debt > 0).length;
  const loyalCount = clients.filter((c) => c.is_loyal).length;
  const visibleClients = filteredClients.filter((c) =>
    filter === "debt" ? c.total_debt > 0 : filter === "loyal" ? c.is_loyal : true
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-violet-700"
          >
            <UserPlus className="h-4 w-4" />
            {t("new_client")}
          </button>
        </div>

        <div className="relative">
          <label htmlFor="client-search" className="sr-only">{t("search")}</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
          <input
            id="client-search"
            type="search"
            placeholder={t("search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] pl-11 pr-4 text-[15px] font-medium transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setFilter("all")} className={chipClass(filter === "all")}>
            {t("filter_all")} <span className="ml-1 font-mono tabular-nums opacity-70">{clients.length}</span>
          </button>
          <button type="button" onClick={() => setFilter("debt")} className={chipClass(filter === "debt")}>
            {t("filter_debt")} <span className="ml-1 font-mono tabular-nums opacity-70">{debtorCount}</span>
          </button>
          <button type="button" onClick={() => setFilter("loyal")} className={chipClass(filter === "loyal")}>
            {t("filter_loyal")} <span className="ml-1 font-mono tabular-nums opacity-70">{loyalCount}</span>
          </button>
        </div>

        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
          {visibleClients.map((client) => {
            const missing = Math.max(0, LOYALTY_MIN_PURCHASES - client.recent_purchases);
            return (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => openEditModal(client)}
                  aria-label={`${t("edit")} ${client.name}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[var(--surface-2)]"
                >
                  <span
                    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold ${
                      client.is_loyal
                        ? "bg-saffron/20 text-amber-900 ring-2 ring-saffron dark:text-saffron"
                        : "bg-zinc-100 text-zinc-600 dark:bg-[var(--surface-2)] dark:text-zinc-300"
                    }`}
                  >
                    {getInitials(client.name)}
                    {client.is_loyal && (
                      <Star aria-hidden="true" className="absolute -right-1 -top-1 h-4 w-4 fill-saffron text-saffron" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-zinc-900 dark:text-white">{client.name}</span>
                      {client.is_loyal && (
                        <span className="shrink-0 rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-saffron">
                          {t("loyal")}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[12.5px] text-zinc-500">
                      {client.phone ? <span className="font-mono">{client.phone}</span> : t("no_phone")}
                      {" · "}
                      {t("purchases_count", { count: client.total_purchases })}
                    </span>
                    {!client.is_loyal && client.recent_purchases > 0 && missing > 0 && (
                      <span className="block text-[12px] text-zinc-500">{t("loyal_missing", { count: missing })}</span>
                    )}
                    {loyaltyEnabled && client.card && (client.card.stamps > 0 || client.card.rewardAvailable) && (
                      <span className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
                        <StampDots
                          stamps={client.card.stamps}
                          required={client.card.stampsRequired}
                          size="sm"
                          label={t("loyalty_card", { stamps: client.card.stamps, required: client.card.stampsRequired })}
                        />
                        {client.card.rewardAvailable ? (
                          <span className="font-semibold text-amber-800 dark:text-saffron">{t("loyalty_ready")}</span>
                        ) : (
                          <span className="font-mono tabular-nums">{client.card.stamps}/{client.card.stampsRequired}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    {client.total_debt > 0 ? (
                      <>
                        <span className="block font-mono text-[14px] font-semibold tabular-nums text-red-700 dark:text-red-400">
                          {format.money(client.total_debt)}
                        </span>
                        <span className="block text-[11.5px] text-zinc-500">{t("owes")}</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-zinc-500">{t("up_to_date")}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {visibleClients.length === 0 && (
            <li className="px-4 py-10 text-center text-zinc-500">{t("not_found")}</li>
          )}
        </ul>
      </div>

      <Modal isOpen={isNewClientModalOpen} onClose={closeNewClientModal} title={t("new_client_modal_title")}>
        <form onSubmit={handleNewClientSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("full_name")}</label>
            <input
              required
              type="text"
              placeholder={t("full_name_placeholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("phone_whatsapp")}</label>
            <div className="flex gap-2">
              <PhoneCountryCodeSelect value={newCountryCode} onChange={setNewCountryCode} label={t("phone_country_code")} />
              <input
                type="tel"
                placeholder={t("phone_placeholder")}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
              />
            </div>
          </div>

          {createError && <p className="text-[13px] font-medium text-red-500">{createError}</p>}

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeNewClientModal} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[var(--line)] transition-colors">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm">
              {t("create")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editingClient} onClose={closeEditModal} title={t("edit_client_modal_title")}>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("full_name")}</label>
            <input
              required
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("phone_whatsapp")}</label>
            <div className="flex gap-2">
              <PhoneCountryCodeSelect value={editCountryCode} onChange={setEditCountryCode} label={t("phone_country_code")} />
              <input
                type="tel"
                placeholder={t("phone_placeholder")}
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
              />
            </div>
          </div>

          {editError && <p className="text-[13px] font-medium text-red-500">{editError}</p>}

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeEditModal} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[var(--line)] transition-colors">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm">
              {t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

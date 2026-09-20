"use client";

import { useState, useTransition } from "react";
import { UserPlus, AlertCircle, Star, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { PHONE_COUNTRY_CODES } from "@/lib/phoneCountryCodes";
import { addClient, updateClient } from "../actions";

export type ClientData = {
  id: string;
  name: string;
  phone: string;
  total_purchases: number;
  total_spent: number;
  total_debt: number;
  first_purchase_date: string;
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
}: {
  clients: ClientData[];
  defaultPhoneCountryCode?: string;
}) {
  const t = useTranslations("Clients");
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const isRecurring = (client: ClientData) => {
    // Règle : > 5 achats OU inscrit depuis plus de 3 mois
    if (client.total_purchases > 5) return true;

    const firstPurchase = new Date(client.first_purchase_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return firstPurchase <= threeMonthsAgo;
  };

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
      const formData = new FormData();
      formData.set("name", newName);
      formData.set("phone", newPhone);
      formData.set("phone_country_code", newCountryCode);
      const result = await addClient(formData);
      if (result.error) {
        setCreateError(result.error);
        return;
      }
      alert(t("new_client_success"));
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
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", editName);
      formData.set("phone", editPhone);
      formData.set("phone_country_code", editCountryCode);
      const result = await updateClient(editingClient.id, formData);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      closeEditModal();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{t("base_clients")}</h2>
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            {t("new_client")}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden dark:border-[#2d2936] dark:bg-[#1C1A22]">
          <div className="p-4 border-b border-zinc-100 dark:border-[#2d2936]">
            <input
              type="text"
              placeholder={t("search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400 dark:border-[#2d2936] dark:bg-[#1C1A22]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#2d2936]">
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("name")}</th>
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("phone")}</th>
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("status")}</th>
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("total_purchases")}</th>
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("debts")}</th>
                  <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
                {filteredClients.map((client) => {
                  const recurring = isRecurring(client);
                  return (
                    <tr key={client.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 font-bold text-zinc-900 dark:text-white">{client.name}</td>
                      <td className="p-4 font-mono text-zinc-500 group-hover:text-violet-600 dark:group-hover:text-violet-400">{client.phone || "-"}</td>
                      <td className="p-4">
                        {recurring ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            <Star className="h-3 w-3" /> {t("loyal")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-800 dark:bg-[#2d2936] dark:text-zinc-300">
                            {t("standard")}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-zinc-900 tabular-nums dark:text-white">{client.total_purchases}</td>
                      <td className="p-4 text-right">
                        {client.total_debt > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            {client.total_debt.toLocaleString("fr-FR")}
                          </span>
                        ) : (
                          <span className="font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">0</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEditModal(client)}
                          title={t("edit")}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-zinc-100 text-zinc-600 hover:bg-violet-600 hover:text-white dark:bg-[#2d2936] dark:text-zinc-300 dark:hover:bg-violet-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                      {t("not_found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
              />
            </div>
          </div>

          {createError && <p className="text-[13px] font-medium text-red-500">{createError}</p>}

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeNewClientModal} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#2d2936] transition-colors">
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
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
              />
            </div>
          </div>

          {editError && <p className="text-[13px] font-medium text-red-500">{editError}</p>}

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeEditModal} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#2d2936] transition-colors">
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

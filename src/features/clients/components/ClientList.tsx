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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("base_clients")}</h2>
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            <UserPlus className="h-4 w-4" />
            {t("new_client")}
          </button>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b">
            <input
              type="text"
              placeholder={t("search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-sm rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
                <tr>
                  <th className="p-4 font-medium">{t("name")}</th>
                  <th className="p-4 font-medium">{t("phone")}</th>
                  <th className="p-4 font-medium">{t("status")}</th>
                  <th className="p-4 font-medium text-right">{t("total_purchases")}</th>
                  <th className="p-4 font-medium text-right">{t("debts")}</th>
                  <th className="p-4 font-medium text-right">{t("action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients.map((client) => {
                  const recurring = isRecurring(client);
                  return (
                    <tr key={client.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="p-4 font-medium">{client.name}</td>
                      <td className="p-4">{client.phone || "-"}</td>
                      <td className="p-4">
                        {recurring ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <Star className="h-3 w-3" /> {t("loyal")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                            {t("standard")}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">{client.total_purchases}</td>
                      <td className="p-4 text-right">
                        {client.total_debt > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                            <AlertCircle className="h-4 w-4" />
                            {client.total_debt.toLocaleString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-zinc-500">0</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEditModal(client)}
                          title={t("edit")}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
        <form onSubmit={handleNewClientSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("full_name")}</label>
            <input
              required
              type="text"
              placeholder={t("full_name_placeholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("phone_whatsapp")}</label>
            <div className="flex gap-2">
              <PhoneCountryCodeSelect value={newCountryCode} onChange={setNewCountryCode} label={t("phone_country_code")} />
              <input
                type="tel"
                placeholder={t("phone_placeholder")}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeNewClientModal} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black">
              {t("create")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editingClient} onClose={closeEditModal} title={t("edit_client_modal_title")}>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("full_name")}</label>
            <input
              required
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("phone_whatsapp")}</label>
            <div className="flex gap-2">
              <PhoneCountryCodeSelect value={editCountryCode} onChange={setEditCountryCode} label={t("phone_country_code")} />
              <input
                type="tel"
                placeholder={t("phone_placeholder")}
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>

          {editError && <p className="text-sm text-red-500">{editError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeEditModal} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black">
              {t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

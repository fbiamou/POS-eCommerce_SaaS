"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { APP_PAGES, SELLER_DEFAULT_PAGES, type AppPageKey } from "@/lib/appPages";
import { Select } from "@/components/ui/Select";

export function EmployeeAccessFields() {
  const t = useTranslations("Settings");
  const tSidebar = useTranslations("Sidebar");
  const [role, setRole] = useState<"SELLER" | "MANAGER">("SELLER");
  const [checked, setChecked] = useState<Set<AppPageKey>>(new Set(SELLER_DEFAULT_PAGES));

  const togglePage = (key: AppPageKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="role_emp">
          {t("role")}
        </label>
        <Select
          id="role_emp"
          name="role"
          value={role}
          onChange={(v) => setRole(v as "SELLER" | "MANAGER")}
          options={[
            { value: "SELLER", label: t("role_cashier") },
            { value: "MANAGER", label: t("role_manager") },
          ]}
        />
      </div>

      {role === "SELLER" && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("employee_access_label")}
          </label>
          <p className="text-xs text-zinc-400 mb-2">{t("employee_access_hint")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {APP_PAGES.map((page) => (
              <label
                key={page.key}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="allowed_pages"
                  value={page.key}
                  checked={checked.has(page.key)}
                  onChange={() => togglePage(page.key)}
                  className="rounded"
                />
                {tSidebar(page.key)}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

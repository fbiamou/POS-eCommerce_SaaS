import "server-only";

import { createClient } from "@/utils/supabase/server";

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
};

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, phone, is_active")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }
  return data ?? [];
}

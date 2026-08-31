"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { parseImportCsv, type ImportRowError } from "./csv";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function findOrCreateCategory(
  supabase: SupabaseServerClient,
  shopId: string,
  categoryText: string
): Promise<string | null> {
  if (!categoryText) return null;

  const { data: existingCategory } = await supabase
    .from("categories")
    .select("id")
    .eq("shop_id", shopId)
    .ilike("name", categoryText)
    .maybeSingle();

  if (existingCategory) return existingCategory.id;

  const { data: newCategory, error: catError } = await supabase
    .from("categories")
    .insert({ name: categoryText, shop_id: shopId })
    .select("id")
    .single();

  if (!catError && newCategory) return newCategory.id;
  return null;
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Non autorisé. Veuillez vous connecter." };
  }

  // Obtenir le shop_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", user.id)
    .single();

  if (!profile?.shop_id) {
    return { error: "Boutique non trouvée." };
  }

  // Retrieve fields
  const name = formData.get("name") as string;
  const categoryText = formData.get("category") as string;
  const type = formData.get("type") as string;
  const brand = formData.get("brand") as string;

  const purchasePrice = parseInt(formData.get("purchase_price") as string || "0");
  const sellingPrice = parseInt(formData.get("price") as string || "0");
  const stockQty = parseInt(formData.get("stock_qty") as string || "0");

  let finalName = name;
  if (type) finalName += ` - ${type}`;
  if (brand) finalName += ` - ${brand}`;

  try {
    const categoryId = await findOrCreateCategory(supabase, profile.shop_id, categoryText);

    const { error: insertError } = await supabase
      .from("products")
      .insert({
        shop_id: profile.shop_id,
        name: finalName,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        quantity_in_stock: stockQty,
      });

    if (insertError) {
      console.error("Product insert error:", insertError);
      return { error: "Erreur lors de l'enregistrement du produit." };
    }

    revalidatePath("/stock");
    revalidatePath("/sales");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Add product failed:", err);
    return { error: "Erreur interne." };
  }
}

export type ImportSummary = {
  created: number;
  restocked: number;
  errors: ImportRowError[];
};

export async function importProductsCsv(formData: FormData): Promise<{ summary?: ImportSummary; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autorisé. Veuillez vous connecter." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", user.id)
    .single();
  if (!profile?.shop_id) return { error: "Boutique non trouvée." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier sélectionné." };

  const text = await file.text();
  let parsed: ReturnType<typeof parseImportCsv>;
  try {
    parsed = parseImportCsv(text);
  } catch (err: any) {
    return { error: "Fichier CSV invalide: " + (err.message ?? "format illisible") };
  }

  const { rows, errors } = parsed;
  let created = 0;
  let restocked = 0;

  for (const row of rows) {
    let finalName = row.name;
    if (row.type) finalName += ` - ${row.type}`;
    if (row.brand) finalName += ` - ${row.brand}`;

    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("shop_id", profile.shop_id)
      .eq("name", finalName)
      .maybeSingle();

    if (existingProduct) {
      const { error: rpcError } = await supabase.rpc("restock_product", {
        _shop_id: profile.shop_id,
        _product_id: existingProduct.id,
        _quantity: row.quantity,
        _new_purchase_price: row.purchase_price || null,
        _new_selling_price: row.selling_price || null,
      });
      if (rpcError) {
        errors.push({ line: 0, message: `"${finalName}": ${rpcError.message}` });
        continue;
      }
      restocked++;
    } else {
      const categoryId = await findOrCreateCategory(supabase, profile.shop_id, row.category);
      const { error: insertError } = await supabase.from("products").insert({
        shop_id: profile.shop_id,
        name: finalName,
        category_id: categoryId,
        purchase_price: row.purchase_price,
        selling_price: row.selling_price,
        quantity_in_stock: row.quantity,
      });
      if (insertError) {
        errors.push({ line: 0, message: `"${finalName}": ${insertError.message}` });
        continue;
      }
      created++;
    }
  }

  revalidatePath("/stock");
  revalidatePath("/sales");
  revalidatePath("/");

  return { summary: { created, restocked, errors } };
}

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
  const description = (formData.get("description") as string) || null;
  const isPublishedOnline = formData.get("is_published_online") === "true";

  let finalName = name;
  if (type) finalName += ` - ${type}`;
  if (brand) finalName += ` - ${brand}`;

  try {
    const categoryId = await findOrCreateCategory(supabase, profile.shop_id, categoryText);

    const { data: newProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        shop_id: profile.shop_id,
        name: finalName,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        quantity_in_stock: stockQty,
        description,
        is_published_online: isPublishedOnline,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Product insert error:", insertError);
      return { error: "Erreur lors de l'enregistrement du produit." };
    }

    revalidatePath("/stock");
    revalidatePath("/sales");
    revalidatePath("/");

    return { success: true, productId: newProduct.id };
  } catch (err: any) {
    console.error("Add product failed:", err);
    return { error: "Erreur interne." };
  }
}

export async function updateProduct(formData: FormData): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autorisé. Veuillez vous connecter." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", user.id)
    .single();
  if (!profile?.shop_id) return { error: "Boutique non trouvée." };

  const productId = formData.get("id") as string;
  const name = formData.get("name") as string;
  const categoryText = formData.get("category") as string;
  const purchasePrice = parseInt((formData.get("purchase_price") as string) || "0");
  const sellingPrice = parseInt((formData.get("selling_price") as string) || "0");
  const newQuantity = parseInt((formData.get("quantity_in_stock") as string) || "0");
  const description = (formData.get("description") as string) || null;
  const isPublishedOnline = formData.get("is_published_online") === "true";

  if (!productId || !name) {
    return { error: "Champs requis manquants." };
  }

  try {
    const categoryId = await findOrCreateCategory(supabase, profile.shop_id, categoryText);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        name,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        description,
        is_published_online: isPublishedOnline,
      })
      .eq("id", productId)
      .eq("shop_id", profile.shop_id);

    if (updateError) {
      console.error("Product update error:", updateError);
      return { error: "Erreur lors de la mise à jour du produit." };
    }

    // Stock quantity changes go through the centralized RPC so the
    // adjustment is logged as a stock movement, never a bare UPDATE.
    const { error: rpcError } = await supabase.rpc("adjust_product_stock", {
      _shop_id: profile.shop_id,
      _product_id: productId,
      _new_quantity: newQuantity,
    });
    if (rpcError) {
      console.error("Stock adjustment error:", rpcError);
      return { error: "Produit mis à jour, mais erreur lors de l'ajustement du stock." };
    }

    revalidatePath("/stock");
    revalidatePath("/sales");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Update product failed:", err);
    return { error: "Erreur interne." };
  }
}

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ success?: true; imageUrl?: string; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autorisé." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", user.id)
    .single();
  if (!profile?.shop_id) return { error: "Boutique non trouvée." };

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { error: "Aucune image sélectionnée." };

  const ext = file.name.split(".").pop();
  const filePath = `${profile.shop_id}/${productId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Product image upload error:", uploadError);
    return { error: "Erreur lors du téléversement de l'image." };
  }

  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", productId)
    .eq("shop_id", profile.shop_id);

  if (updateError) {
    console.error("Product image_url update error:", updateError);
    return { error: "Image téléversée, mais erreur de mise à jour du produit." };
  }

  revalidatePath("/stock");
  return { success: true, imageUrl: publicUrl };
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

      // image_url / en_ligne are optional and left untouched when blank —
      // only overwrite them if the CSV row actually specified a value.
      const catalogUpdates: Record<string, string | boolean> = {};
      if (row.image_url) catalogUpdates.image_url = row.image_url;
      if (row.is_published_online !== undefined) catalogUpdates.is_published_online = row.is_published_online;
      if (Object.keys(catalogUpdates).length > 0) {
        await supabase.from("products").update(catalogUpdates).eq("id", existingProduct.id);
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
        image_url: row.image_url || null,
        is_published_online: row.is_published_online ?? false,
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

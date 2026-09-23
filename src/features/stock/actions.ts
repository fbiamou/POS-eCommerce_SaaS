"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { FeedbackCode } from "@/lib/feedback";
import { parseImportCsv, type ImportRowError } from "./csv";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const optionalText = (value: FormDataEntryValue | null) => (typeof value === "string" && value.trim()) || null;
const integerOrZero = (value: FormDataEntryValue | null) => {
  const parsed = parseInt((value as string) || "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

async function getShopId(supabase: SupabaseServerClient): Promise<{ shopId?: string; error?: FeedbackCode }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "shop_not_found" };
  return { shopId: profile.shop_id };
}

async function findOrCreateCategory(
  supabase: SupabaseServerClient,
  shopId: string,
  categoryText: string | null
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

// A product is always created with zero stock, then its opening quantity
// goes through adjust_product_stock so it is recorded as a stock movement
// like every other change (AGENTS.md: stock writes go through one RPC).
async function setOpeningStock(
  supabase: SupabaseServerClient,
  shopId: string,
  productId: string,
  quantity: number
): Promise<boolean> {
  if (quantity <= 0) return true;
  const { error } = await supabase.rpc("adjust_product_stock", {
    _shop_id: shopId,
    _product_id: productId,
    _new_quantity: quantity,
  });
  if (error) console.error("Opening stock error:", error);
  return !error;
}

function revalidateStockPages() {
  revalidatePath("/stock");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
}

export async function addProduct(
  formData: FormData
): Promise<{ success?: true; productId?: string; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { shopId, error: shopError } = await getShopId(supabase);
  if (!shopId) return { error: shopError };

  const name = optionalText(formData.get("name"));
  if (!name) return { error: "required_fields_missing" };

  const stockQty = Math.max(0, integerOrZero(formData.get("stock_qty")));

  try {
    const categoryId = await findOrCreateCategory(supabase, shopId, optionalText(formData.get("category")));

    const { data: newProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        name,
        brand: optionalText(formData.get("brand")),
        product_type: optionalText(formData.get("type")),
        category_id: categoryId,
        purchase_price: Math.max(0, integerOrZero(formData.get("purchase_price"))),
        selling_price: Math.max(0, integerOrZero(formData.get("price"))),
        quantity_in_stock: 0,
        description: optionalText(formData.get("description")),
        is_published_online: formData.get("is_published_online") === "true",
      })
      .select("id")
      .single();

    if (insertError || !newProduct) {
      console.error("Product insert error:", insertError);
      return { error: "product_save_failed" };
    }

    const stockSet = await setOpeningStock(supabase, shopId, newProduct.id, stockQty);
    revalidateStockPages();
    if (!stockSet) return { error: "stock_adjust_failed", productId: newProduct.id };

    return { success: true, productId: newProduct.id };
  } catch (err) {
    console.error("Add product failed:", err);
    return { error: "generic_error" };
  }
}

export async function updateProduct(formData: FormData): Promise<{ success?: true; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { shopId, error: shopError } = await getShopId(supabase);
  if (!shopId) return { error: shopError };

  const productId = formData.get("id") as string;
  const name = optionalText(formData.get("name"));
  if (!productId || !name) return { error: "required_fields_missing" };

  const newQuantity = integerOrZero(formData.get("quantity_in_stock"));
  if (newQuantity < 0) return { error: "invalid_quantity" };

  try {
    const categoryId = await findOrCreateCategory(supabase, shopId, optionalText(formData.get("category")));

    const { error: updateError } = await supabase
      .from("products")
      .update({
        name,
        brand: optionalText(formData.get("brand")),
        product_type: optionalText(formData.get("type")),
        category_id: categoryId,
        purchase_price: Math.max(0, integerOrZero(formData.get("purchase_price"))),
        selling_price: Math.max(0, integerOrZero(formData.get("selling_price"))),
        description: optionalText(formData.get("description")),
        is_published_online: formData.get("is_published_online") === "true",
      })
      .eq("id", productId)
      .eq("shop_id", shopId);

    if (updateError) {
      console.error("Product update error:", updateError);
      return { error: "product_update_failed" };
    }

    // Stock quantity changes go through the centralized RPC so the
    // adjustment is logged as a stock movement, never a bare UPDATE.
    const { error: rpcError } = await supabase.rpc("adjust_product_stock", {
      _shop_id: shopId,
      _product_id: productId,
      _new_quantity: newQuantity,
    });
    if (rpcError) {
      console.error("Stock adjustment error:", rpcError);
      return { error: "stock_adjust_failed" };
    }

    revalidateStockPages();
    return { success: true };
  } catch (err) {
    console.error("Update product failed:", err);
    return { error: "generic_error" };
  }
}

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ success?: true; imageUrl?: string; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { shopId, error: shopError } = await getShopId(supabase);
  if (!shopId) return { error: shopError };

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { error: "no_file_selected" };

  const ext = file.name.split(".").pop();
  const filePath = `${shopId}/${productId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Product image upload error:", uploadError);
    return { error: "image_upload_failed" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", productId)
    .eq("shop_id", shopId);

  if (updateError) {
    console.error("Product image_url update error:", updateError);
    return { error: "image_saved_update_failed" };
  }

  revalidatePath("/stock");
  return { success: true, imageUrl: publicUrl };
}

export type ImportSummary = {
  created: number;
  restocked: number;
  errors: ImportRowError[];
};

export async function importProductsCsv(formData: FormData): Promise<{ summary?: ImportSummary; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { shopId, error: shopError } = await getShopId(supabase);
  if (!shopId) return { error: shopError };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "csv_file_missing" };

  let parsed: ReturnType<typeof parseImportCsv>;
  try {
    parsed = parseImportCsv(await file.text());
  } catch (err) {
    console.error("CSV parse error:", err);
    return { error: "csv_invalid" };
  }

  const { rows, errors } = parsed;
  let created = 0;
  let restocked = 0;

  for (const row of rows) {
    // The same product is the same name, brand and type: "Fond de teint
    // NC45" from Mac and from Fenty are two different products.
    let lookup = supabase.from("products").select("id").eq("shop_id", shopId).eq("name", row.name);
    lookup = row.brand ? lookup.eq("brand", row.brand) : lookup.is("brand", null);
    lookup = row.type ? lookup.eq("product_type", row.type) : lookup.is("product_type", null);
    const { data: existingProduct } = await lookup.maybeSingle();

    if (existingProduct) {
      const { error: rpcError } = await supabase.rpc("restock_product", {
        _shop_id: shopId,
        _product_id: existingProduct.id,
        _quantity: row.quantity,
        _new_purchase_price: row.purchase_price || null,
        _new_selling_price: row.selling_price || null,
      });
      if (rpcError) {
        errors.push({ line: row.line, code: "restock_failed", value: row.name });
        continue;
      }

      // image_url / en_ligne are optional and left untouched when blank —
      // only overwrite them if the CSV row actually specified a value.
      const catalogUpdates: Record<string, string | boolean> = {};
      if (row.image_url) catalogUpdates.image_url = row.image_url;
      if (row.is_published_online !== undefined) catalogUpdates.is_published_online = row.is_published_online;
      if (Object.keys(catalogUpdates).length > 0) {
        await supabase.from("products").update(catalogUpdates).eq("id", existingProduct.id).eq("shop_id", shopId);
      }

      restocked++;
    } else {
      const categoryId = await findOrCreateCategory(supabase, shopId, row.category || null);
      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          name: row.name,
          brand: row.brand || null,
          product_type: row.type || null,
          category_id: categoryId,
          purchase_price: row.purchase_price,
          selling_price: row.selling_price,
          quantity_in_stock: 0,
          image_url: row.image_url || null,
          is_published_online: row.is_published_online ?? false,
        })
        .select("id")
        .single();
      if (insertError || !newProduct) {
        errors.push({ line: row.line, code: "create_failed", value: row.name });
        continue;
      }
      const stockSet = await setOpeningStock(supabase, shopId, newProduct.id, row.quantity);
      if (!stockSet) {
        errors.push({ line: row.line, code: "restock_failed", value: row.name });
      }
      created++;
    }
  }

  revalidateStockPages();
  return { summary: { created, restocked, errors } };
}

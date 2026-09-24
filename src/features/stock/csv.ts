import { parse } from "csv-parse/sync";

export const CSV_HEADERS = [
  "nom",
  "categorie",
  "type",
  "marque",
  "prix_achat",
  "prix_vente",
  "quantite",
  "image_url",
  "en_ligne",
  "fournisseur",
  "pays_origine",
] as const;

export type ImportRow = {
  line: number;
  name: string;
  category: string;
  type: string;
  brand: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  image_url: string;
  supplier: string;
  origin_country: string;
  // undefined = column left blank / not mentioned — leave existing value
  // untouched on restock, default to "not published" only for a new product.
  is_published_online: boolean | undefined;
};

// A code rather than a sentence: the interface translates it (Stock.import_row_*),
// with `value` being the offending cell or product name.
export type ImportRowErrorCode =
  | "missing_name"
  | "invalid_selling_price"
  | "invalid_quantity"
  | "invalid_purchase_price"
  | "create_failed"
  | "restock_failed";

export type ImportRowError = {
  line: number;
  code: ImportRowErrorCode;
  value?: string;
};

function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export function buildCsvTemplate(): string {
  return toCsv([
    [...CSV_HEADERS],
    ["Fond de teint NC45", "Cosmétiques", "Fond de teint", "Mac", 3000, 6000, 10, "", "non", "", ""],
  ]);
}

export function productsToCsv(
  products: {
    name: string;
    brand?: string | null;
    product_type?: string | null;
    category: string;
    purchase_price: number;
    selling_price: number;
    quantity_in_stock: number;
    image_url?: string | null;
    is_published_online?: boolean;
    supplier?: string | null;
    origin_country?: string | null;
  }[]
): string {
  const rows: (string | number)[][] = [[...CSV_HEADERS]];
  for (const p of products) {
    rows.push([
      p.name,
      p.category,
      p.product_type || "",
      p.brand || "",
      p.purchase_price,
      p.selling_price,
      p.quantity_in_stock,
      p.image_url || "",
      p.is_published_online ? "oui" : "non",
      p.supplier || "",
      p.origin_country || "",
    ]);
  }
  return toCsv(rows);
}

const TRUTHY_VALUES = new Set(["oui", "true", "1", "yes"]);

export function parseImportCsv(text: string): { rows: ImportRow[]; errors: ImportRowError[] } {
  const records: Record<string, string>[] = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  });

  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  records.forEach((record, index) => {
    const line = index + 2; // +1 for header row, +1 for 1-indexing
    const name = record.nom?.trim();
    const sellingPriceRaw = record.prix_vente?.trim();
    const quantityRaw = record.quantite?.trim();

    if (!name) {
      errors.push({ line, code: "missing_name" });
      return;
    }
    const sellingPrice = sellingPriceRaw ? Number(sellingPriceRaw) : 0;
    if (sellingPriceRaw && (Number.isNaN(sellingPrice) || sellingPrice < 0)) {
      errors.push({ line, code: "invalid_selling_price", value: sellingPriceRaw });
      return;
    }
    const quantity = Number(quantityRaw);
    if (!quantityRaw || Number.isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      errors.push({ line, code: "invalid_quantity", value: quantityRaw ?? "" });
      return;
    }
    const purchasePriceRaw = record.prix_achat?.trim();
    const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : 0;
    if (purchasePriceRaw && (Number.isNaN(purchasePrice) || purchasePrice < 0)) {
      errors.push({ line, code: "invalid_purchase_price", value: purchasePriceRaw });
      return;
    }

    const enLigneRaw = record.en_ligne?.trim().toLowerCase();

    rows.push({
      line,
      name,
      category: record.categorie?.trim() || "",
      type: record.type?.trim() || "",
      brand: record.marque?.trim() || "",
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      quantity,
      image_url: record.image_url?.trim() || "",
      supplier: record.fournisseur?.trim() || "",
      origin_country: record.pays_origine?.trim() || "",
      is_published_online: enLigneRaw ? TRUTHY_VALUES.has(enLigneRaw) : undefined,
    });
  });

  return { rows, errors };
}

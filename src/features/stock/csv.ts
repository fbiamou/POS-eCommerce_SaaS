import { parse } from "csv-parse/sync";

export const CSV_HEADERS = ["nom", "categorie", "type", "marque", "prix_achat", "prix_vente", "quantite"] as const;

export type ImportRow = {
  name: string;
  category: string;
  type: string;
  brand: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
};

export type ImportRowError = {
  line: number;
  message: string;
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
    ["Fond de teint Mac NC45", "Cosmétiques", "", "Mac", 3000, 6000, 10],
  ]);
}

export function productsToCsv(
  products: { name: string; category: string; purchase_price: number; selling_price: number; quantity_in_stock: number }[]
): string {
  const rows: (string | number)[][] = [[...CSV_HEADERS]];
  for (const p of products) {
    rows.push([p.name, p.category, "", "", p.purchase_price, p.selling_price, p.quantity_in_stock]);
  }
  return toCsv(rows);
}

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
      errors.push({ line, message: "Nom manquant" });
      return;
    }
    const sellingPrice = sellingPriceRaw ? Number(sellingPriceRaw) : 0;
    if (sellingPriceRaw && (Number.isNaN(sellingPrice) || sellingPrice < 0)) {
      errors.push({ line, message: `Prix de vente invalide: "${sellingPriceRaw}"` });
      return;
    }
    const quantity = Number(quantityRaw);
    if (!quantityRaw || Number.isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      errors.push({ line, message: `Quantité invalide: "${quantityRaw}"` });
      return;
    }
    const purchasePriceRaw = record.prix_achat?.trim();
    const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : 0;
    if (purchasePriceRaw && Number.isNaN(purchasePrice)) {
      errors.push({ line, message: `Prix d'achat invalide: "${purchasePriceRaw}"` });
      return;
    }

    rows.push({
      name,
      category: record.categorie?.trim() || "",
      type: record.type?.trim() || "",
      brand: record.marque?.trim() || "",
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      quantity,
    });
  });

  return { rows, errors };
}

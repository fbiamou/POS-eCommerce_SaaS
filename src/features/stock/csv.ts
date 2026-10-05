import { parse } from "csv-parse/sync";

// The stock import / export format. The shop downloads it as an Excel
// workbook (lib/xlsx.ts) with its columns in its language; the import reads
// an Excel workbook or a CSV (comma or semicolon), with its columns in
// French, Spanish or English, accents and capitals ignored.

export const STOCK_COLUMNS = [
  "name",
  "category",
  "type",
  "brand",
  "purchase_price",
  "selling_price",
  "quantity",
  "image_url",
  "online",
  "supplier",
  "origin_country",
] as const;
export type StockColumn = (typeof STOCK_COLUMNS)[number];

export type StockLocale = "fr" | "es" | "en";

// Column titles written in the template and the export, per language.
const TITLES: Record<StockLocale, Record<StockColumn, string>> = {
  fr: {
    name: "nom",
    category: "categorie",
    type: "type",
    brand: "marque",
    purchase_price: "prix_achat",
    selling_price: "prix_vente",
    quantity: "quantite",
    image_url: "image_url",
    online: "en_ligne",
    supplier: "fournisseur",
    origin_country: "pays_origine",
  },
  es: {
    name: "nombre",
    category: "categoria",
    type: "tipo",
    brand: "marca",
    purchase_price: "precio_compra",
    selling_price: "precio_venta",
    quantity: "cantidad",
    image_url: "url_imagen",
    online: "en_linea",
    supplier: "proveedor",
    origin_country: "pais_origen",
  },
  en: {
    name: "name",
    category: "category",
    type: "type",
    brand: "brand",
    purchase_price: "purchase_price",
    selling_price: "selling_price",
    quantity: "quantity",
    image_url: "image_url",
    online: "online",
    supplier: "supplier",
    origin_country: "origin_country",
  },
};

const YES: Record<StockLocale, string> = { fr: "oui", es: "sí", en: "yes" };
const NO: Record<StockLocale, string> = { fr: "non", es: "no", en: "no" };
const TRUTHY_VALUES = new Set(["oui", "si", "yes", "true", "1", "x", "o", "y", "s"]);

const EXAMPLE: Record<StockLocale, (string | number)[]> = {
  fr: ["Fond de teint NC45", "Cosmétiques", "Fond de teint", "Mac", 3000, 6000, 10, "", "non", "", ""],
  es: ["Base de maquillaje NC45", "Cosméticos", "Base de maquillaje", "Mac", 3000, 6000, 10, "", "no", "", ""],
  en: ["Foundation NC45", "Cosmetics", "Foundation", "Mac", 3000, 6000, 10, "", "no", "", ""],
};

/** "Catégorie", "CATEGORIA " and "categoría" all become "categoria". */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

// Every column title understood at import, in the three languages.
const ALIASES = new Map<string, StockColumn>();
for (const titles of Object.values(TITLES)) {
  for (const column of STOCK_COLUMNS) ALIASES.set(normalise(titles[column]), column);
}
ALIASES.set("prix", "selling_price");
ALIASES.set("precio", "selling_price");
ALIASES.set("price", "selling_price");
ALIASES.set("stock", "quantity");
ALIASES.set("photo", "image_url");
ALIASES.set("foto", "image_url");
ALIASES.set("imagen", "image_url");
ALIASES.set("image", "image_url");

export function stockLocale(value: string | null | undefined): StockLocale {
  return value === "es" || value === "en" ? value : "fr";
}

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

export type StockProduct = {
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
};

/** The template's rows: the column titles, then one example item. */
export function templateRows(locale: StockLocale): (string | number)[][] {
  return [STOCK_COLUMNS.map((c) => TITLES[locale][c]), EXAMPLE[locale]];
}

/** The shop's items, in the import format: edit and import back. */
export function productsToRows(products: StockProduct[], locale: StockLocale): (string | number)[][] {
  const rows: (string | number)[][] = [STOCK_COLUMNS.map((c) => TITLES[locale][c])];
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
      p.is_published_online ? YES[locale] : NO[locale],
      p.supplier || "",
      p.origin_country || "",
    ]);
  }
  return rows;
}

function csvField(value: string | number): string {
  const str = String(value);
  return /[",;\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export function buildCsvTemplate(locale: StockLocale = "fr"): string {
  return toCsv(templateRows(locale));
}

export function productsToCsv(products: StockProduct[], locale: StockLocale = "fr"): string {
  return toCsv(productsToRows(products, locale));
}

/** A CSV as rows of texts: comma or semicolon, whichever the file uses. */
export function csvToRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  return parse(clean, { delimiter, skip_empty_lines: true, relax_column_count: true }) as string[][];
}

export function parseImportCsv(text: string): { rows: ImportRow[]; errors: ImportRowError[] } {
  return parseImportRows(csvToRows(text));
}

/** Rows read from a CSV or an Excel sheet, the first one being the titles. */
export function parseImportRows(table: string[][]): { rows: ImportRow[]; errors: ImportRowError[] } {
  const [titles = [], ...lines] = table;
  const columnOf = new Map<StockColumn, number>();
  titles.forEach((title, index) => {
    const column = ALIASES.get(normalise(String(title ?? "")));
    if (column && !columnOf.has(column)) columnOf.set(column, index);
  });

  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  lines.forEach((cells, index) => {
    const line = index + 2; // +1 for the title row, +1 for 1-indexing
    const cell = (column: StockColumn) => {
      const at = columnOf.get(column);
      return at === undefined ? "" : String(cells[at] ?? "").trim();
    };
    if (cells.every((value) => String(value ?? "").trim() === "")) return;

    const name = cell("name");
    const sellingPriceRaw = cell("selling_price");
    const quantityRaw = cell("quantity");

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
      errors.push({ line, code: "invalid_quantity", value: quantityRaw });
      return;
    }
    const purchasePriceRaw = cell("purchase_price");
    const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : 0;
    if (purchasePriceRaw && (Number.isNaN(purchasePrice) || purchasePrice < 0)) {
      errors.push({ line, code: "invalid_purchase_price", value: purchasePriceRaw });
      return;
    }

    const online = normalise(cell("online"));

    rows.push({
      line,
      name,
      category: cell("category"),
      type: cell("type"),
      brand: cell("brand"),
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      quantity,
      image_url: cell("image_url"),
      supplier: cell("supplier"),
      origin_country: cell("origin_country"),
      is_published_online: online ? TRUTHY_VALUES.has(online) : undefined,
    });
  });

  return { rows, errors };
}

import { describe, expect, it } from "vitest";
import { buildCsvTemplate, parseImportCsv, parseImportRows, productsToCsv, productsToRows, templateRows } from "./csv";

const header = "nom,categorie,type,marque,prix_achat,prix_vente,quantite,image_url,en_ligne";

describe("parseImportCsv", () => {
  it("reads brand and type as separate fields", () => {
    const { rows, errors } = parseImportCsv(`${header}\nFond de teint NC45,Cosmétiques,Fond de teint,Mac,3000,6000,10,,oui\n`);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 2,
      name: "Fond de teint NC45",
      category: "Cosmétiques",
      type: "Fond de teint",
      brand: "Mac",
      purchase_price: 3000,
      selling_price: 6000,
      quantity: 10,
      is_published_online: true,
    });
  });

  it("treats blank optional fields as unknown, not as errors", () => {
    const { rows, errors } = parseImportCsv(`${header}\nPerruque lisse,,,,,,5,,\n`);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ brand: "", type: "", purchase_price: 0, selling_price: 0, is_published_online: undefined });
  });

  it("reports each invalid row with its line and a translatable code", () => {
    const { rows, errors } = parseImportCsv(
      `${header}\n,Cat,,,,100,1,,\nRobe,,,,,-5,1,,\nCrème,,,,,100,0,,\nPoudre,,,,abc,100,2,,\n`
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { line: 2, code: "missing_name" },
      { line: 3, code: "invalid_selling_price", value: "-5" },
      { line: 4, code: "invalid_quantity", value: "0" },
      { line: 5, code: "invalid_purchase_price", value: "abc" },
    ]);
  });
});

describe("CSV export", () => {
  it("round-trips through the import format", () => {
    const csv = productsToCsv([
      {
        name: "Robe, longue",
        brand: "Zara",
        product_type: "Robe",
        category: "Prêt-à-porter",
        purchase_price: 8000,
        selling_price: 15000,
        quantity_in_stock: 3,
        is_published_online: true,
      },
    ]);
    const { rows } = parseImportCsv(csv);
    expect(rows[0]).toMatchObject({ name: "Robe, longue", brand: "Zara", type: "Robe", quantity: 3, is_published_online: true });
  });

  it("offers a template that imports cleanly", () => {
    expect(parseImportCsv(buildCsvTemplate()).errors).toEqual([]);
  });
});

describe("columns in the shop's language", () => {
  it("reads Spanish and English titles, accents and capitals ignored", () => {
    const { rows, errors } = parseImportRows([
      ["Nombre", "Categoría", "Precio_venta", "CANTIDAD", "En línea", "URL_imagen"],
      ["Peluca lisa", "Pelucas", "32000", "9", "sí", "https://example.com/p.jpg"],
    ]);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: "Peluca lisa", category: "Pelucas", selling_price: 32000, quantity: 9, is_published_online: true, image_url: "https://example.com/p.jpg" });
    expect(parseImportRows([["name", "quantity", "online"], ["Wig", "2", "no"]]).rows[0]).toMatchObject({ name: "Wig", quantity: 2, is_published_online: false });
  });

  it("reads a CSV separated by semicolons", () => {
    const { rows, errors } = parseImportCsv("\uFEFFnom;prix_vente;quantite\r\nRobe, longue;15000;3\r\n");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: "Robe, longue", selling_price: 15000, quantity: 3 });
  });

  it("offers a template and an export that import cleanly in each language", () => {
    for (const locale of ["fr", "es", "en"] as const) {
      expect(parseImportRows(templateRows(locale).map((r) => r.map(String))).errors).toEqual([]);
      const exported = productsToRows([{ name: "Robe", category: "", purchase_price: 0, selling_price: 100, quantity_in_stock: 2, is_published_online: true }], locale);
      expect(parseImportRows(exported.map((r) => r.map(String))).rows[0]).toMatchObject({ name: "Robe", quantity: 2, is_published_online: true });
    }
  });
});

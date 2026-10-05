import { describe, expect, it } from "vitest";
import { buildXlsx, columnName } from "./xlsx";
import { isXlsx, readXlsxRows } from "./xlsxRead";

describe("Excel workbooks", () => {
  it("names columns like Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("reads back what it writes: texts, numbers, accents and symbols", () => {
    const rows = [
      ["nombre", "precio_venta", "cantidad"],
      ["Peluca lisa 20\" & rizos <nuevo>", 32000, 9],
      ["=SUMA(A1)", "", 1],
    ];
    const bytes = buildXlsx([{ name: "Artículos", rows }, { name: "Ayuda", rows: [["x"]] }]);
    expect(isXlsx(bytes)).toBe(true);
    expect(readXlsxRows(bytes)).toEqual([
      ["nombre", "precio_venta", "cantidad"],
      ["Peluca lisa 20\" & rizos <nuevo>", "32000", "9"],
      ["=SUMA(A1)", "", "1"],
    ]);
  });

  it("keeps sheet names valid for Excel", () => {
    const bytes = buildXlsx([{ name: "Ventes / factures: [2026]", rows: [["a"]] }]);
    expect(new TextDecoder().decode(bytes)).toContain('name="Ventes   factures   2026"');
  });
});

import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "./zip";
import { csvCell, exportDate, toExportCsv } from "./csv";
import { buildExportFiles, EXPORT_CODES, type ExportData } from "./build";
import fr from "../../../messages/fr.json";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

const empty: ExportData = {
  shop: null,
  categories: [],
  suppliers: [],
  products: [],
  clients: [],
  profiles: [],
  invoices: [],
  invoiceItems: [],
  payments: [],
  stockMovements: [],
  purchaseOrders: [],
  purchaseOrderItems: [],
  shipments: [],
  shipmentItems: [],
  onlineOrders: [],
  onlineOrderItems: [],
  reminders: [],
};

const t = (key: string) => key;

function csvRows(content: string): string[][] {
  return content.replace("\uFEFF", "").trimEnd().split("\r\n").map((line) => line.split(";"));
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });

  it("writes one local header per file and a central directory", () => {
    const zip = buildZip([{ name: "a.csv", content: "x" }, { name: "b.csv", content: "yz" }], new Date(2026, 8, 25, 10, 0, 0));
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
  });
});

describe("export csv", () => {
  it("separates with semicolons, quotes when needed and starts with a BOM", () => {
    const csv = toExportCsv(["nom", "prix"], [["Perruque; lisse", 25000], ['Crème "douce"', 7900]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Perruque; lisse";25000');
    expect(csv).toContain('"Crème ""douce""";7900');
  });

  it("neutralises formulas but keeps numbers and phone numbers intact", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("+240 222 123 456")).toBe("+240 222 123 456");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
  });

  it("writes dates in the shop's time zone", () => {
    expect(exportDate("2026-09-25T23:30:00Z", "Africa/Malabo")).toBe("2026-09-26 00:30");
    expect(exportDate(null, "Africa/Malabo")).toBe("");
  });
});

describe("full data export", () => {
  it("produces one file per subject, even for a new shop", () => {
    const files = buildExportFiles(empty, t, "Africa/Malabo", "fr");
    expect(files.map((f) => f.name)).toContain("file_invoices.csv");
    expect(files).toHaveLength(17);
    for (const f of files) expect(csvRows(f.content)[0].length).toBeGreaterThan(0);
  });

  it("resolves links to names and computes what is left to pay", () => {
    const data: ExportData = {
      ...empty,
      clients: [{ id: "c1", name: "Awa", phone: "+240 555", is_active: true, created_at: "2026-09-01T10:00:00Z" }],
      profiles: [{ id: "u1", full_name: "Mireille", role: "SELLER", is_active: true, created_at: "2026-09-01T10:00:00Z" }],
      products: [
        {
          id: "p1", name: "Perruque", category_id: null, product_type: null, brand: null, supplier: null, supplier_id: null,
          origin_country: null, purchase_price: 15000, selling_price: 25000, quantity_in_stock: 3, is_published_online: false,
          is_active: true, description: null, image_url: null, created_at: "2026-09-01T10:00:00Z",
        },
      ],
      invoices: [
        {
          id: "i1", invoice_number: "F-0001", client_id: "c1", total_amount: 25000, discount_amount: 0, paid_amount: 10000,
          status: "PARTIAL", loyalty_reward_used: false, created_by: "u1", created_at: "2026-09-02T10:00:00Z",
        },
      ],
      invoiceItems: [{ invoice_id: "i1", product_id: "p1", quantity: 1, unit_price: 25000, total_price: 25000 }],
    };
    const files = buildExportFiles(data, t, "Africa/Malabo", "fr");
    const invoices = csvRows(files.find((f) => f.name === "file_invoices.csv")!.content);
    expect(invoices[1]).toEqual(["i1", "F-0001", "2026-09-02 11:00", "Awa", "+240 555", "25000", "0", "10000", "15000", "invoice_status_PARTIAL", "Mireille"]);
    const items = csvRows(files.find((f) => f.name === "file_invoice_items.csv")!.content);
    expect(items[1]).toEqual(["F-0001", "Perruque", "1", "25000", "25000"]);
  });

  it("translates every database code in each language, and never shows it raw", () => {
    for (const messages of [fr, es, en]) {
      const exportTexts = messages.Export as Record<string, string>;
      for (const [kind, values] of Object.entries(EXPORT_CODES)) {
        for (const value of values) expect(exportTexts[`${kind}_${value}`], `${kind}_${value}`).toBeTruthy();
      }
    }

    const tEs = (key: string) => (es.Export as Record<string, string>)[key] ?? key;
    const data: ExportData = {
      ...empty,
      shop: { shop_name: "Mamá B", shop_phone: null, shop_email: null, shop_address: null, country_code: "GQ", tax_id: null, trade_register: null, shop_slug: null },
      profiles: [{ id: "u1", full_name: "Mireille", role: "SELLER", is_active: true, created_at: "2026-09-01T10:00:00Z" }],
      invoices: [
        {
          id: "i1", invoice_number: "F-0001", client_id: null, total_amount: 25000, discount_amount: 0, paid_amount: 0,
          status: "UNPAID", loyalty_reward_used: false, created_by: "u1", created_at: "2026-09-02T10:00:00Z",
        },
      ],
      reminders: [{ client_id: null, invoice_id: "i1", template_name: "MANUAL_CLICK_TO_CHAT", status: "MANUAL", sent_at: "2026-09-03T10:00:00Z" }],
    };
    const files = buildExportFiles(data, tEs, "Africa/Malabo", "es");
    const cells = files.flatMap((f) => csvRows(f.content).flat());
    const rawCodes = new Set<string>(Object.values(EXPORT_CODES).flat());
    expect(cells.filter((cell) => rawCodes.has(cell))).toEqual([]);
    expect(cells).not.toContain("MANUAL_CLICK_TO_CHAT");
    expect(cells).toContain("Impagada");
    expect(cells).toContain("Cajero(a)");
    expect(cells).toContain("Guinea Ecuatorial");
  });
});

import { inflateRawSync } from "node:zlib";

// Reads the first sheet of an Excel workbook (.xlsx) as rows of texts, on the
// server (stock import). An .xlsx is a ZIP of XML files: the cells are in
// xl/worksheets/sheetN.xml, the texts most often in xl/sharedStrings.xml.

export function isXlsx(bytes: Uint8Array): boolean {
  // Every ZIP starts with "PK\x03\x04".
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not_a_zip");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("bad_zip");
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + compressed);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, new Uint8Array(inflateRawSync(data)));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** All the <t> texts of a piece of XML, joined (rich text has several). */
function texts(xml: string): string {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (m) => decodeXml(m[1])).join("");
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+$/, "").toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

export function readXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzip(bytes);
  const read = (name: string) => {
    const data = files.get(name);
    return data ? new TextDecoder().decode(data) : null;
  };

  // The first sheet named in the workbook, else sheet1.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  const firstId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (firstId && rels) {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${firstId}"[^>]*\\bTarget="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${firstId}"`))?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new Error("no_sheet");

  const shared = Array.from((read("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g), (m) => texts(m[1]));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    let next = 0;
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const inner = cellMatch[2] ?? "";
      const ref = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const index = ref ? columnIndex(ref) : next;
      next = index + 1;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = "";
      if (type === "s") text = shared[Number(value)] ?? "";
      else if (type === "inlineStr") text = texts(inner);
      else if (value !== undefined) text = decodeXml(value);
      cells[index] = text;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    // Keep the line numbers of the sheet (errors name them).
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(cells);
  }
  return rows;
}

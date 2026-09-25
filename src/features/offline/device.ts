// Each device that sells (a phone or a computer, one browser each) is a numbered till with its own series
// of invoice numbers: FAC-2026-1-0042 on till 1, FAC-2026-2-0015 on till 2
// (decided 25/09/2026, like Loyverse and Shopify POS). The number is given on
// the phone, online or offline, and never changes afterwards.
//
// The till is kept in localStorage rather than in the shop database, so it
// survives a logout: the same device keeps its number and its series.

export type DeviceState = {
  id: string;
  number: number;
  /** Next sequence number to give; always above every number already used. */
  nextSeq: number;
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function storageKey(shopId: string) {
  return `wishop-device-${shopId}`;
}

export function readDevice(storage: Storage, shopId: string): DeviceState | null {
  try {
    const raw = storage.getItem(storageKey(shopId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<DeviceState>;
    if (typeof value.id !== "string" || !Number.isInteger(value.number) || !Number.isInteger(value.nextSeq)) return null;
    return value as DeviceState;
  } catch {
    return null;
  }
}

export function writeDevice(storage: Storage, shopId: string, device: DeviceState) {
  storage.setItem(storageKey(shopId), JSON.stringify(device));
}

/**
 * Merges the server's answer with what the phone knows. The series resumes
 * after the highest number, whether the server or the phone saw it last:
 * sales waiting to be sent already used numbers the server does not know yet.
 */
export function reconcileDevice(
  local: DeviceState | null,
  server: { device_id: string; device_number: number; last_seq: number }
): DeviceState {
  const localNext = local && local.id === server.device_id ? local.nextSeq : 1;
  return {
    id: server.device_id,
    number: server.device_number,
    nextSeq: Math.max(server.last_seq + 1, localNext),
  };
}

/** Same format as the database (record_sale): FAC-<year>-<till>-<0042>. */
export function deviceInvoiceNumber(saleTime: Date, deviceNumber: number, seq: number) {
  return `FAC-${saleTime.getUTCFullYear()}-${deviceNumber}-${String(seq).padStart(4, "0")}`;
}

/**
 * Takes the next number of the series. Two tabs of the same browser share the
 * series: the Web Locks API makes them take numbers one after the other.
 */
export async function takeNextSeq(storage: Storage, shopId: string): Promise<{ device: DeviceState; seq: number } | null> {
  const take = () => {
    const device = readDevice(storage, shopId);
    if (!device) return null;
    const seq = device.nextSeq;
    writeDevice(storage, shopId, { ...device, nextSeq: seq + 1 });
    return { device, seq };
  };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return take();
  return locks.request(`wishop-device-seq-${shopId}`, take);
}

/**
 * Gives a number back when the sale that took it was refused at once (stock,
 * credit...), so the series has no gap. Only possible if no other sale took
 * a number in between.
 */
export async function releaseSeq(storage: Storage, shopId: string, seq: number): Promise<void> {
  const release = () => {
    const device = readDevice(storage, shopId);
    if (device && device.nextSeq === seq + 1) writeDevice(storage, shopId, { ...device, nextSeq: seq });
  };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return release();
  await locks.request(`wishop-device-seq-${shopId}`, release);
}

/** A short name for the till list: "Android · Chrome", "iPhone · Safari". */
export function deviceLabel(userAgent: string): string {
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /SamsungBrowser/.test(userAgent)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(userAgent)
        ? "Opera"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Chrome\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "";
  return [system, browser].filter(Boolean).join(" · ");
}

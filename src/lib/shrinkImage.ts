// Phone photos weigh several megabytes, and a server action refuses more
// than a few (next.config.ts, serverActions.bodySizeLimit). Resize in the
// browser before sending: lighter over a slow mobile connection, and always
// under the limit.
//
// - photo: JPEG, longest side 1600 px (products, parcels);
// - logo: PNG (keeps a transparent background), longest side 512 px.
// SVG and GIF are sent as they are. A format the browser cannot decode
// (HEIC on most Android browsers) is sent as it is too.

export type ShrinkKind = "photo" | "logo";

const SETTINGS: Record<ShrinkKind, { maxSide: number; type: "image/jpeg" | "image/png"; ext: string; quality?: number }> = {
  photo: { maxSide: 1600, type: "image/jpeg", ext: "jpg", quality: 0.82 },
  logo: { maxSide: 512, type: "image/png", ext: "png" },
};

export async function shrinkImage(file: File, kind: ShrinkKind): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  const { maxSide, type, ext, quality } = SETTINGS[kind];
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    // Keep the original when it was already smaller (a small PNG logo).
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, { type });
  } catch {
    return file;
  }
}

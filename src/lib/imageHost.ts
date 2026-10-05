// Next's image optimiser only accepts WISHOP's own storage (next.config.ts,
// images.remotePatterns). A photo address typed in a stock import can be on
// any site: shown as it is (unoptimized), it loads on the storefront too.
export function isOwnImage(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

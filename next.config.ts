import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The WISHOP marketing page is a static site in public/landing (built with
  // the 10k-websites method). Files in public are not served for a bare
  // folder path, so /landing is mapped to its index.html.
  async rewrites() {
    return [
      { source: "/landing", destination: "/landing/index.html" },
      // Terms of use and privacy policy accepted at sign-up (src/lib/terms.ts).
      { source: "/legal/conditions", destination: "/legal/conditions.html" },
      { source: "/legal/condiciones", destination: "/legal/condiciones.html" },
    ];
  },
  // Preview phase: keep the marketing page out of search engines until the
  // public launch (remove together with the robots meta in its index.html).
  async headers() {
    return [
      {
        source: "/landing/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/landing",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Provisional terms, under legal review: not for search engines.
      {
        source: "/legal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);

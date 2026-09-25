import { NextResponse } from "next/server";

// The version the server runs. A page kept by the device for offline use
// compares it with its own (NEXT_PUBLIC_BUILD_ID, next.config.ts) and offers
// to update when they differ.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

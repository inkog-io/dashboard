import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/db";

// Aggregates the anonymous_scans table for public consumption.
// Public, no auth. 1h cache + 24h stale-while-revalidate (matches /api/scan-count).
// Used by inkog.io at build time to power the hero stats strip.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getPublicStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[stats/public] error:", err);
    return NextResponse.json({ error: "failed_to_aggregate" }, { status: 500 });
  }
}

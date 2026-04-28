import { NextResponse } from "next/server";
import { getTotalScanCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await getTotalScanCount();
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}

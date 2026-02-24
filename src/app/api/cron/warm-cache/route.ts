import { NextRequest, NextResponse } from "next/server";
import { executeScanPipeline } from "@/app/api/scan-public/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Repos to keep warm in the scan cache.
 * These are shown as "Try an example" on the scan page.
 */
const EXAMPLE_REPOS = [
  "https://github.com/OpenBMB/ChatDev",
  "https://github.com/geekan/MetaGPT",
];

/**
 * GET /api/cron/warm-cache
 *
 * Called by Vercel Cron daily to keep example repo scan results cached.
 * Calls executeScanPipeline directly — no HTTP self-fetch.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { repo: string; status: string; cached?: boolean; duration_ms?: number }[] = [];

  for (const repoUrl of EXAMPLE_REPOS) {
    const start = Date.now();
    try {
      const result = await executeScanPipeline(repoUrl, null);
      const duration = Date.now() - start;

      if (result.ok) {
        results.push({
          repo: repoUrl.replace("https://github.com/", ""),
          status: "ok",
          cached: result.cached,
          duration_ms: duration,
        });
      } else {
        results.push({
          repo: repoUrl.replace("https://github.com/", ""),
          status: `error: ${result.code}`,
          duration_ms: duration,
        });
      }
    } catch (err) {
      results.push({
        repo: repoUrl.replace("https://github.com/", ""),
        status: `exception: ${err instanceof Error ? err.message : "unknown"}`,
        duration_ms: Date.now() - start,
      });
    }
  }

  console.log("Cache warm results:", JSON.stringify(results));

  return NextResponse.json({
    warmed_at: new Date().toISOString(),
    results,
  });
}

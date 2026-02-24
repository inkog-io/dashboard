import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Repos to keep warm in the scan cache.
 * These are shown as "Try an example" on the scan page.
 * The cron job rescans each one to ensure instant results when users click.
 */
const EXAMPLE_REPOS = [
  "https://github.com/OpenBMB/ChatDev",
  "https://github.com/geekan/MetaGPT",
];

/**
 * GET /api/cron/warm-cache
 *
 * Called by Vercel Cron every 30 minutes to keep example repo scan results
 * cached. Each repo is scanned via the same public scan endpoint, which
 * uses its built-in 1-hour cache dedup — if a recent scan exists, it
 * returns instantly. If the cache has expired, it runs a fresh scan.
 *
 * Secured via CRON_SECRET (Vercel sets this automatically for cron jobs
 * and sends it as the Authorization: Bearer header).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret — Vercel sends this as Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const results: { repo: string; status: string; cached?: boolean; duration_ms?: number }[] = [];

  for (const repoUrl of EXAMPLE_REPOS) {
    const start = Date.now();
    try {
      // Call our own scan endpoint internally
      const baseUrl =
        process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

      const res = await fetch(`${baseUrl}/api/scan-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl }),
      });

      const data = await res.json();
      const duration = Date.now() - start;

      if (res.ok) {
        results.push({
          repo: repoUrl.replace("https://github.com/", ""),
          status: "ok",
          cached: data.cached ?? false,
          duration_ms: duration,
        });
      } else {
        results.push({
          repo: repoUrl.replace("https://github.com/", ""),
          status: `error: ${data.code || res.status}`,
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

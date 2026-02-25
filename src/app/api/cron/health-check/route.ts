import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BACKEND_HEALTH_URL = "https://api.inkog.io/v1/health/deep";
const HEALTH_TIMEOUT_MS = 15_000;

/**
 * GET /api/cron/health-check
 *
 * Called by Vercel Cron every 5 minutes to verify backend availability.
 * Logs errors to Vercel logs and optionally sends Slack alerts.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const res = await fetch(BACKEND_HEALTH_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[health-check] Backend unhealthy: HTTP ${res.status} (${duration}ms)`,
        body.slice(0, 500)
      );

      await notifySlack(
        `Backend unhealthy: HTTP ${res.status} (${duration}ms)`
      );

      return NextResponse.json({
        status: "unhealthy",
        http_status: res.status,
        duration_ms: duration,
        checked_at: new Date().toISOString(),
      });
    }

    const data = await res.json();

    console.log(
      `[health-check] Backend healthy (${duration}ms)`,
      JSON.stringify(data.checks ?? {})
    );

    return NextResponse.json({
      status: "healthy",
      duration_ms: duration,
      checks: data.checks,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    const duration = Date.now() - start;
    const message =
      err instanceof DOMException && err.name === "AbortError"
        ? `Backend unreachable: timeout after ${HEALTH_TIMEOUT_MS}ms`
        : `Backend unreachable: ${err instanceof Error ? err.message : "unknown"}`;

    console.error(`[health-check] ${message} (${duration}ms)`);
    await notifySlack(message);

    return NextResponse.json({
      status: "unreachable",
      error: message,
      duration_ms: duration,
      checked_at: new Date().toISOString(),
    });
  }
}

/** Send a Slack alert if webhook URL is configured. */
async function notifySlack(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_HEALTH_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[Inkog Health] ${message}`,
      }),
    });
  } catch {
    // Don't fail the health check if Slack notification fails
    console.warn("[health-check] Failed to send Slack notification");
  }
}

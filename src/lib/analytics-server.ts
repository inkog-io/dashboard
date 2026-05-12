/**
 * Server-side PostHog telemetry for the public scan flow.
 *
 * Why this exists: the browser-side analytics in `analytics-public.ts` fires
 * `anonymous_scan_started` / `_completed` / `_error` from the React component.
 * If the user closes the tab, loses network, or otherwise drops mid-scan, the
 * terminal event never fires and the funnel shows started > completed + error.
 * The 2026-05-11 incident (1 user, 9 starts, 1 complete) is exactly that shape.
 *
 * Server-side events from the Next.js API route give us ground truth even when
 * the client disconnects: every scan that begins on the server fires either a
 * `server_scan_completed` or `server_scan_failed` regardless of client state.
 *
 * Distinct from the client events on purpose — client events represent
 * user-perceived outcomes (did they see results); server events represent
 * actual backend outcomes (did we run a scan). Both views are useful.
 */

import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Best-effort capture — never throws, never blocks the request.
 * Use the IP-derived distinct_id so events can be stitched to the browser
 * session that initiated the scan (PostHog merges by distinct_id; same IP is
 * a reasonable bridge for anonymous flows).
 */
function capture(event: string, distinctId: string, properties: Record<string, unknown>) {
  try {
    const ph = getClient();
    if (!ph) return;
    ph.capture({
      distinctId,
      event,
      properties: {
        $process_person_profile: false,
        ...properties,
      },
    });
  } catch {
    // never surface analytics failures into the request path
  }
}

export function trackServerScanStarted(props: {
  distinctId: string;
  repo_url: string;
  ip?: string | null;
}) {
  capture("server_scan_started", props.distinctId, {
    repo_url: props.repo_url,
    ip: props.ip || undefined,
  });
}

export function trackServerScanCompleted(props: {
  distinctId: string;
  repo_url: string;
  report_id: string;
  findings_count: number;
  critical_count: number;
  duration_ms: number;
  cached: boolean;
}) {
  capture("server_scan_completed", props.distinctId, {
    repo_url: props.repo_url,
    report_id: props.report_id,
    findings_count: props.findings_count,
    critical_count: props.critical_count,
    duration_ms: props.duration_ms,
    cached: props.cached,
  });
}

export function trackServerScanFailed(props: {
  distinctId: string;
  repo_url: string;
  error_code: string;
  error_message: string;
  duration_ms: number;
  status_code?: number;
}) {
  capture("server_scan_failed", props.distinctId, {
    repo_url: props.repo_url,
    error_code: props.error_code,
    error_message: props.error_message,
    duration_ms: props.duration_ms,
    status_code: props.status_code,
  });
}

/**
 * Force-flush pending events. Call before the API route returns to ensure
 * events reach PostHog before the serverless function terminates.
 */
export async function flushAnalytics(): Promise<void> {
  try {
    if (client) await client.flush();
  } catch {
    // swallow — flush failure shouldn't fail the request
  }
}

/**
 * PostHog Analytics for Public PLG Funnel
 *
 * Tracks anonymous scan → report view → auth conversion events.
 */

import { posthog } from "@/components/PostHogProvider";

export function trackAnonymousScanStarted(properties: {
  repo_url: string;
}): void {
  posthog.capture("anonymous_scan_started", {
    timestamp: new Date().toISOString(),
    ...properties,
  });
}

export function trackAnonymousScanCompleted(properties: {
  repo_url: string;
  report_id: string;
  findings_count: number;
  critical_count: number;
  duration_ms: number;
}): void {
  posthog.capture("anonymous_scan_completed", properties);
}

export function trackPaywallAuthClicked(properties: {
  report_id: string;
  findings_hidden: number;
  auth_method: "sign_in" | "sign_up";
}): void {
  posthog.capture("paywall_auth_clicked", properties);
}

export function trackReportViewed(properties: {
  report_id: string;
  is_authenticated: boolean;
  referrer?: string;
}): void {
  posthog.capture("report_viewed", properties);
}

export function trackReportShared(properties: {
  report_id: string;
  method: "copy_link";
}): void {
  posthog.capture("report_shared", properties);
}

export function trackAnonymousScanError(properties: {
  repo_url: string;
  error_code: string;
  error_message: string;
  duration_ms: number;
  retry_count: number;
}): void {
  posthog.capture("anonymous_scan_error", properties);
}

export function trackReportCtaScanClicked(properties: {
  report_id: string;
  source_repo: string;
}): void {
  posthog.capture("report_cta_scan_clicked", properties);
}

export function trackDeepScanCompleted(properties: {
  report_id: string;
  repo_name: string;
  deep_findings_count: number;
  agent_framework?: string;
  severity_summary?: Record<string, number>;
}): void {
  posthog.capture("deep_scan_completed", properties);
}

export function trackDeepScanViewed(properties: {
  report_id: string;
  is_authenticated: boolean;
  deep_findings_visible: number;
  deep_findings_gated: number;
}): void {
  posthog.capture("deep_scan_viewed", properties);
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Shield,
  FileText,
  Link2,
  CheckCircle,
  Lock,
  Key,
  GitBranch,
  Settings2,
  ArrowRight,
  Cpu,
  Sparkles,
} from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { FindingCard } from "@/components/FindingCard";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { CodeSnippetDisplay } from "@/components/CodeSnippetDisplay";
import { GovernanceScore } from "@/components/GovernanceScore";
// SecurityMetricCard removed — data now shown inline in hero section
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  trackReportViewed,
  trackPaywallAuthClicked,
  trackReportShared,
  trackReportCtaScanClicked,
  trackDeepScanCompleted,
  trackDeepScanViewed,
} from "@/lib/analytics-public";
import type { ScanResult, Finding } from "@/lib/api";

/** Summary-only finding returned by the server for unauthenticated users */
interface GatedFindingSummary {
  id: string;
  severity: string;
  pattern_id: string;
  finding_type?: string;
  confidence?: number;
  governance_category?: string;
  display_title?: string;
  fix_difficulty?: 'easy' | 'moderate' | 'complex';
}

interface ReportScanResult extends ScanResult {
  gated_findings?: GatedFindingSummary[];
}

interface DeepFinding {
  finding_number: number;
  title: string;
  detection_id?: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  affected_files?: { file_path: string; line_numbers: string }[];
  proof?: { file_path: string; start_line: number; end_line: number; code_snippet: string; language: string }[];
  explanation: string;
  recommended_action: string;
  compliance_mappings?: { framework: string; reference: string }[];
}

interface DeepGatedSummary {
  finding_number: number;
  title: string;
  severity: string;
  category: string;
  confidence: string;
}

interface DeepScanResult {
  agent_profile: {
    purpose: string;
    framework: string;
    language: string;
    architecture_summary: string;
    data_sources?: string[];
    data_sinks?: string[];
    external_integrations?: string[];
    high_risk_operations?: string[];
    is_multi_agent?: boolean;
    trust_boundaries?: string;
  } | null;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  findings: DeepFinding[];
  gated_findings: DeepGatedSummary[];
  report: { total_findings: number; files_audited: number } | null;
}

interface ReportData {
  report_id: string;
  repo_name: string;
  repo_url: string;
  scan_result: ReportScanResult;
  scanned_at: string;
  claimed: boolean;
  deep_scan_status?: "not_triggered" | "processing" | "completed" | "failed";
  deep_scan_result?: DeepScanResult | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  HIGH: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  MEDIUM: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  LOW: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  HIGH: "border-l-orange-500",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-blue-500",
};

export default function PublicReportPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanUrl, setScanUrl] = useState("");
  const claimedRef = useRef(false);

  // Deep scan polling state
  const [deepStatus, setDeepStatus] = useState<"not_triggered" | "processing" | "completed" | "failed">("not_triggered");
  const [deepResult, setDeepResult] = useState<DeepScanResult | null>(null);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollDeepScan = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan-public?report_id=${reportId}`);
      if (!res.ok) return;
      const data = await res.json();
      const status = data.deep_scan_status || "not_triggered";
      setDeepStatus(status);
      if (status === "completed" && data.deep_scan_result) {
        setDeepResult(data.deep_scan_result);
        const dr = data.deep_scan_result;
        trackDeepScanCompleted({
          report_id: reportId,
          repo_name: data.repo_name || "",
          deep_findings_count: (dr.findings?.length || 0) + (dr.gated_findings?.length || 0),
          agent_framework: dr.agent_profile?.framework,
          severity_summary: dr.severity_summary,
        });
        return; // Stop polling
      }
      if (status === "failed") return; // Stop polling
    } catch {
      // Silently continue polling
    }

    pollCountRef.current++;
    // Poll for max 5 minutes (37 polls at 8s intervals)
    if (pollCountRef.current < 37) {
      pollTimerRef.current = setTimeout(pollDeepScan, 8000);
    }
  }, [reportId]);

  // Fetch report
  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/scan-public?report_id=${reportId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("not_found");
          } else {
            setError("fetch_failed");
          }
          setLoading(false);
          return;
        }
        const data = await res.json();
        setReport(data);

        // Initialize deep scan state from initial fetch
        const initialDeepStatus = data.deep_scan_status || "not_triggered";
        setDeepStatus(initialDeepStatus);
        if (initialDeepStatus === "completed" && data.deep_scan_result) {
          setDeepResult(data.deep_scan_result);
          const dr = data.deep_scan_result;
          trackDeepScanViewed({
            report_id: reportId,
            is_authenticated: !!isSignedIn,
            deep_findings_visible: dr.findings?.length || 0,
            deep_findings_gated: dr.gated_findings?.length || 0,
          });
        } else if (initialDeepStatus === "processing") {
          // Start polling
          pollCountRef.current = 0;
          pollTimerRef.current = setTimeout(pollDeepScan, 8000);
        }

        trackReportViewed({
          report_id: reportId,
          is_authenticated: !!isSignedIn,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        });
      } catch {
        setError("fetch_failed");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // Claim report when user signs in
  useEffect(() => {
    if (isSignedIn && userId && report && !claimedRef.current) {
      claimedRef.current = true;
      fetch("/api/scan-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, user_id: userId }),
      }).catch(() => {});
    }
  }, [isSignedIn, userId, report, reportId]);

  function handleCopyLink() {
    const url = `${window.location.origin}/report/${reportId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackReportShared({ report_id: reportId, method: "copy_link" });
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Loading report...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error: not found
  if (error === "not_found") {
    const repoUrl = report?.repo_url;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Report not found
            </h1>
            <p className="text-muted-foreground mb-6">
              This report may have expired. Run a new scan to generate a fresh
              report.
            </p>
            <Button
              onClick={() =>
                router.push(repoUrl ? `/scan?url=${encodeURIComponent(repoUrl)}` : "/scan")
              }
            >
              Scan again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Generic error
  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-6">
              We couldn&apos;t load this report. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </main>
      </div>
    );
  }

  const { scan_result: result } = report;
  const hasDeepResults = deepStatus === "completed" && deepResult !== null;
  const isDeepProcessing = deepStatus === "processing";

  const fullFindings = [...(result.findings || [])].sort((a, b) => {
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    if (sevDiff !== 0) return sevDiff;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const gatedSummaries: GatedFindingSummary[] = result.gated_findings || [];
  const hasGatedFindings = gatedSummaries.length > 0;
  const totalFindingsCount = result.findings_count;
  const hasFindings = totalFindingsCount > 0;

  const gatedSeverityCounts: Record<string, number> = {};
  for (const f of gatedSummaries) {
    gatedSeverityCounts[f.severity] = (gatedSeverityCounts[f.severity] || 0) + 1;
  }
  const severityBreakdown = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    .filter((s) => gatedSeverityCounts[s])
    .map((s) => `${gatedSeverityCounts[s]} ${s.charAt(0) + s.slice(1).toLowerCase()}`)
    .join(", ");

  const fixDifficultyCounts: Record<string, number> = {};
  for (const f of gatedSummaries) {
    if (f.fix_difficulty) {
      fixDifficultyCounts[f.fix_difficulty] = (fixDifficultyCounts[f.fix_difficulty] || 0) + 1;
    }
  }
  const fixCtaPart = fixDifficultyCounts.easy
    ? `and apply ${fixDifficultyCounts.easy} easy ${fixDifficultyCounts.easy === 1 ? "fix" : "fixes"}`
    : fixDifficultyCounts.moderate
      ? `and apply ${fixDifficultyCounts.moderate} moderate ${fixDifficultyCounts.moderate === 1 ? "fix" : "fixes"}`
      : fixDifficultyCounts.complex
        ? `and apply ${fixDifficultyCounts.complex} ${fixDifficultyCounts.complex === 1 ? "fix" : "fixes"}`
        : null;

  // Deep scan gated findings
  const deepGatedSummaries: DeepGatedSummary[] = deepResult?.gated_findings || [];
  const hasDeepGatedFindings = deepGatedSummaries.length > 0;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      {/* Contextual value banner */}
      {!loading && report && !isSignedIn && (
        <div className="w-full border-b border-border bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            {hasGatedFindings || hasDeepGatedFindings ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Report generated for{" "}
                  <span className="font-medium text-foreground">{report.repo_name}</span>.{" "}
                  {gatedSummaries.length + deepGatedSummaries.length} more {gatedSummaries.length + deepGatedSummaries.length === 1 ? "finding" : "findings"} + fix code available.
                </p>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => {
                    trackPaywallAuthClicked({
                      report_id: reportId,
                      findings_hidden: gatedSummaries.length + deepGatedSummaries.length,
                      auth_method: "sign_up",
                    });
                    router.push(
                      `/sign-up?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                    );
                  }}
                >
                  See All Findings
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Scan your own repositories for free.
                </p>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => router.push("/scan")}
                >
                  Scan Your Repo
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Signed-in power-user banner */}
      {!loading && report && isSignedIn && (
        <div className="w-full border-b border-border bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Full report unlocked.</span>
              {" "}Want this on every push?
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              asChild
            >
              <a
                href="https://github.com/apps/inkog-scanner/installations/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install GitHub App
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </a>
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero risk score */}
        {(() => {
          const riskScore = result.risk_score;
          const scoreColor =
            riskScore >= 70
              ? "text-red-500"
              : riskScore >= 40
                ? "text-amber-500"
                : "text-green-500";
          const strokeColor =
            riskScore >= 70
              ? "hsl(var(--severity-critical))"
              : riskScore >= 40
                ? "hsl(var(--severity-medium))"
                : "hsl(var(--severity-safe))";

          // Auto-generate one-sentence summary from top patterns
          const patternCounts: Record<string, number> = {};
          for (const f of fullFindings) {
            const label = f.pattern_id?.replace(/_/g, " ") || "vulnerability";
            patternCounts[label] = (patternCounts[label] || 0) + 1;
          }
          const topPatterns = Object.entries(patternCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => name);
          const summaryText = hasFindings && topPatterns.length > 0
            ? `${result.critical_count > 0 ? `${result.critical_count} critical vulnerabilit${result.critical_count === 1 ? "y" : "ies"}` : `${totalFindingsCount} finding${totalFindingsCount === 1 ? "" : "s"}`} including ${topPatterns.join(" and ")}.`
            : null;

          // Severity stat pills
          const stats: { label: string; value: number; color: string }[] = [];
          if (result.critical_count > 0) stats.push({ label: "Critical", value: result.critical_count, color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" });
          if (result.high_count > 0) stats.push({ label: "High", value: result.high_count, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" });
          if (result.medium_count > 0) stats.push({ label: "Medium", value: result.medium_count, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" });
          if (result.low_count > 0) stats.push({ label: "Low", value: result.low_count, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" });

          return (
            <div className="bg-card rounded-xl border border-border p-6 sm:p-8 mb-8 text-center">
              {/* Top row: repo name, date, share */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                  <code className="bg-muted px-2 py-0.5 rounded font-mono break-all">
                    {report.repo_name}
                  </code>
                  <span className="text-xs whitespace-nowrap">
                    {new Date(report.scanned_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                    {hasDeepResults ? "Core + Deep" : "Core"}
                  </span>
                  {isDeepProcessing && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                      <span className="w-2 h-2 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                      Deep running
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0 self-start sm:self-auto">
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-1.5" />
                      Share
                    </>
                  )}
                </Button>
              </div>

              {/* Risk score circle */}
              <div className={`relative w-28 h-28 mx-auto mb-4 rounded-full ${riskScore >= 70 ? "animate-risk-glow" : ""}`}>
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="8"
                    strokeDasharray={`${riskScore * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold font-display ${scoreColor}`}>
                    {riskScore}
                  </span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Risk Score</p>

              {/* Stat pills */}
              {hasFindings ? (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">{totalFindingsCount} findings</span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  {stats.map((s) => (
                    <span key={s.label} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${s.color}`}>
                      {s.value} {s.label}
                    </span>
                  ))}
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="text-sm text-muted-foreground">Gov: {result.governance_score}/100</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Clean — No vulnerabilities detected
                  </span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="text-sm text-muted-foreground">Gov: {result.governance_score}/100</span>
                </div>
              )}

              {/* One-sentence summary */}
              {summaryText && (
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {summaryText}
                </p>
              )}
            </div>
          );
        })()}

        {/* Deep analysis processing banner */}
        {isDeepProcessing && (
          <div className="mb-8 px-5 py-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                  Deep analysis running...
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  AI behavioral analysis will appear shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deep Analysis section — above core findings when complete */}
        {hasDeepResults && deepResult && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Deep Analysis
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <Sparkles className="w-2.5 h-2.5" />
                AI-Powered
              </span>
            </div>

            {/* Agent Profile card */}
            {deepResult.agent_profile && (
              <div className="bg-card rounded-xl border border-border p-6 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Agent Profile</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {deepResult.agent_profile.purpose || deepResult.agent_profile.architecture_summary}
                </p>
                <div className="flex flex-wrap gap-2">
                  {deepResult.agent_profile.framework && (
                    <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-mono">
                      {deepResult.agent_profile.framework}
                    </span>
                  )}
                  {deepResult.agent_profile.language && (
                    <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-mono">
                      {deepResult.agent_profile.language}
                    </span>
                  )}
                  {deepResult.agent_profile.is_multi_agent && (
                    <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-mono">
                      Multi-agent
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Deep findings — ungated */}
            {deepResult.findings.length > 0 && (
              <div className="space-y-3 mb-4">
                {deepResult.findings.map((finding) => (
                  <div
                    key={finding.finding_number}
                    className={`bg-card rounded-xl border border-border border-l-2 ${SEVERITY_BORDER[finding.severity] || ""} overflow-hidden`}
                  >
                    <div className="px-5 py-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded border ${SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.LOW}`}>
                          {finding.severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground">
                            {finding.title}
                          </h4>
                        </div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex-shrink-0">
                          <Sparkles className="w-2 h-2" />
                          Deep
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {finding.explanation}
                      </p>

                      {/* Proof code snippet */}
                      {finding.proof && finding.proof.length > 0 && (
                        <div className="mb-3">
                          <CodeSnippetDisplay
                            code={finding.proof[0].code_snippet}
                            file={finding.proof[0].file_path}
                            highlightLine={finding.proof[0].start_line}
                          />
                        </div>
                      )}

                      {/* Recommended action */}
                      {finding.recommended_action && (
                        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground mb-3">
                          <p className="font-medium text-foreground text-xs mb-1">Recommended</p>
                          {finding.recommended_action}
                        </div>
                      )}

                      {/* Compliance tags */}
                      {finding.compliance_mappings && finding.compliance_mappings.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {finding.compliance_mappings.map((m, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800"
                            >
                              {m.framework}: {m.reference}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gated deep findings */}
            {hasDeepGatedFindings && (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-base font-semibold text-foreground">
                    {deepGatedSummaries.length} more deep {deepGatedSummaries.length === 1 ? "finding" : "findings"} detected
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {deepGatedSummaries.map((item) => (
                    <div
                      key={item.finding_number}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded border ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.LOW}`}>
                        {item.severity}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">
                        {item.title}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 ml-auto" />
                    </div>
                  ))}
                </div>
                <div className="px-5 py-5 bg-muted/30 border-t border-border text-center">
                  <Button
                    onClick={() => {
                      trackPaywallAuthClicked({
                        report_id: reportId,
                        findings_hidden: deepGatedSummaries.length,
                        auth_method: "sign_up",
                      });
                      router.push(
                        `/sign-up?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                      );
                    }}
                    className="hover:shadow-[0_0_20px_hsl(239_84%_67%/0.3)] transition-shadow"
                  >
                    Unlock Deep Analysis — Sign Up Free
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Zero findings — success state */}
        {!hasFindings && !hasDeepResults && (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No vulnerabilities found
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Great news! The comprehensive scan found no security issues in
              this repository.
            </p>
          </div>
        )}

        {/* Security Strengths */}
        {result.strengths && result.strengths.length > 0 && (
          <div className="mb-8">
            <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30 overflow-hidden">
              <div className="px-5 py-3 border-b border-green-200 dark:border-green-900">
                <h2 className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Security Strengths
                </h2>
              </div>
              <div className="divide-y divide-green-200 dark:divide-green-900">
                {result.strengths.map((strength) => (
                  <div key={strength.id} className="px-5 py-3 flex items-start gap-3">
                    <Shield className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-900 dark:text-green-200">
                        {strength.title}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                        {strength.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Core findings */}
        {fullFindings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {hasDeepResults ? "Core Analysis" : hasGatedFindings ? "Top Findings" : "Findings"}
            </h2>
            <div className="space-y-4">
              {fullFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    <FindingCard
                      finding={finding}
                      onClick={() => {
                        setSelectedFinding(finding);
                        setDetailsOpen(true);
                      }}
                    />
                    {/* Expanded detail */}
                    <div className="px-4 sm:px-6 pb-6 border-t border-border">
                      {finding.short_description && (
                        <p className="mt-4 text-sm text-muted-foreground">
                          {finding.short_description}
                        </p>
                      )}
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">
                          {finding.message}
                        </p>
                      </div>

                      {finding.explanation_trace && (
                        <div className="mt-4 overflow-x-auto">
                          <h3 className="text-sm font-medium text-foreground mb-2">
                            Analysis Trace
                          </h3>
                          <pre className="text-xs bg-gray-950 text-green-400 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed border border-gray-800">
                            {finding.explanation_trace}
                          </pre>
                        </div>
                      )}

                      {finding.code_snippet && (
                        <div className="mt-4 overflow-x-auto">
                          <h3 className="text-sm font-medium text-foreground mb-2">
                            Code
                          </h3>
                          <CodeSnippetDisplay
                            code={finding.code_snippet}
                            file={finding.file}
                            highlightLine={finding.line}
                          />
                        </div>
                      )}

                      {(finding.remediation_steps?.length || finding.remediation_code) && (
                        <div className="mt-4">
                          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            How to Fix
                            {finding.fix_difficulty && (
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                                finding.fix_difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                finding.fix_difficulty === 'moderate' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}>
                                {finding.fix_difficulty}
                              </span>
                            )}
                          </h3>
                          <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
                            {finding.remediation_steps && finding.remediation_steps.length > 0 && (
                              <ul className="list-disc list-inside space-y-1">
                                {finding.remediation_steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ul>
                            )}
                            {finding.remediation_code && (
                              <div className={`${finding.remediation_steps?.length ? 'mt-3 pt-3 border-t border-border' : ''}`}>
                                <CodeSnippetDisplay
                                  code={finding.remediation_code}
                                  file="fix"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {finding.compliance_mapping && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {finding.compliance_mapping.eu_ai_act_articles?.map(
                            (article) => (
                              <span
                                key={article}
                                className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800"
                              >
                                EU AI Act: {article}
                              </span>
                            )
                          )}
                          {finding.compliance_mapping.owasp_items?.map(
                            (item) => (
                              <span
                                key={item}
                                className="px-2 py-1 text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded border border-purple-200 dark:border-purple-800"
                              >
                                {item}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Gated core findings */}
        {hasGatedFindings && (
          <div className="mb-8">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  {gatedSummaries.length} more{" "}
                  {gatedSummaries.length === 1 ? "finding" : "findings"}{" "}
                  detected
                </h2>
                {severityBreakdown && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Including {severityBreakdown}
                  </p>
                )}
              </div>

              <div className="divide-y divide-border">
                {gatedSummaries.map((item) => {
                  const title = item.display_title
                    || item.pattern_id.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded border ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.LOW}`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">
                        {title}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 ml-auto" />
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-6 bg-muted/30 border-t border-border">
                <div className="text-center max-w-sm mx-auto">
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign in to view {gatedSummaries.length} remaining{" "}
                    {gatedSummaries.length === 1 ? "vulnerability" : "vulnerabilities"}
                    {fixCtaPart ? ` ${fixCtaPart}` : ""}.
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                      <Key className="w-3 h-3" /> CLI & API access
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                      <GitBranch className="w-3 h-3" /> GitHub auto-scan
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                      <Settings2 className="w-3 h-3" /> Custom policies
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => {
                        trackPaywallAuthClicked({
                          report_id: reportId,
                          findings_hidden: gatedSummaries.length,
                          auth_method: "sign_up",
                        });
                        router.push(
                          `/sign-up?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                        );
                      }}
                    >
                      Get Started Free
                    </Button>
                    <button
                      onClick={() => {
                        trackPaywallAuthClicked({
                          report_id: reportId,
                          findings_hidden: gatedSummaries.length,
                          auth_method: "sign_in",
                        });
                        router.push(
                          `/sign-in?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                        );
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Governance section */}
        {hasFindings && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Governance & Compliance
            </h2>
            <GovernanceScore
              score={result.governance_score}
              readiness={result.eu_ai_act_readiness}
              articleMapping={isSignedIn ? result.article_mapping : undefined}
              frameworkMapping={isSignedIn ? result.framework_mapping : undefined}
            />
            {!isSignedIn && (
              <div className="mt-3 px-4 py-3 bg-muted/50 rounded-lg border border-border text-center">
                <p className="text-sm text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                  Sign in to view full article mapping and framework compliance details.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom CTA — inline scan */}
        <div className="mt-4 mb-8 bg-card rounded-xl border border-border p-6 sm:p-8 text-center">
          <div className="max-w-lg mx-auto">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              What does YOUR agent look like?
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Paste a GitHub URL and get a security report in 60 seconds.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={scanUrl}
                onChange={(e) => setScanUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && scanUrl.trim()) {
                    trackReportCtaScanClicked({ report_id: reportId, source_repo: report.repo_name });
                    router.push(`/scan?url=${encodeURIComponent(scanUrl.trim())}`);
                  }
                }}
                placeholder="https://github.com/owner/repo"
                className="flex-1 min-w-0 h-12 px-4 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm transition-colors"
              />
              <Button
                onClick={() => {
                  if (!scanUrl.trim()) return;
                  trackReportCtaScanClicked({ report_id: reportId, source_repo: report.repo_name });
                  router.push(`/scan?url=${encodeURIComponent(scanUrl.trim())}`);
                }}
                disabled={!scanUrl.trim()}
                className="h-12 px-6 rounded-xl font-semibold shrink-0"
              >
                Scan
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-4">
              or{" "}
              <a
                href="https://github.com/apps/inkog-scanner/installations/new"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Install GitHub App for CI/CD scanning
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Finding details slide-out */}
      <FindingDetailsPanel
        finding={selectedFinding}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedFinding(null);
        }}
      />
    </div>
    </ErrorBoundary>
  );
}

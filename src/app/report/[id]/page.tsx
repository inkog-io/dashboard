"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Shield,
  AlertTriangle,
  FileText,
  Activity,
  Link2,
  CheckCircle,
  Lock,
  Key,
  GitBranch,
  Settings2,
  ArrowRight,
} from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { FindingCard } from "@/components/FindingCard";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { CodeSnippetDisplay } from "@/components/CodeSnippetDisplay";
import { GovernanceScore } from "@/components/GovernanceScore";
import { SecurityMetricCard } from "@/components/dashboard/SecurityMetricCard";
import { Button } from "@/components/ui/button";
import type { Strength } from "@/lib/api";
import {
  trackReportViewed,
  trackPaywallAuthClicked,
  trackReportShared,
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
  /** Present only for unauthenticated users — gated findings with detail stripped */
  gated_findings?: GatedFindingSummary[];
}

interface ReportData {
  report_id: string;
  repo_name: string;
  repo_url: string;
  scan_result: ReportScanResult;
  scanned_at: string;
  claimed: boolean;
}

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
  const claimedRef = useRef(false);

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
      }).catch(() => {
        // Non-critical — silently fail
      });
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

  // Server returns findings pre-sorted and pre-split:
  // - result.findings: full-detail findings (all for authenticated, top N for anonymous)
  // - result.gated_findings: summary-only findings (only for anonymous users)
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

  // Build severity breakdown of gated findings for paywall copy
  const gatedSeverityCounts: Record<string, number> = {};
  for (const f of gatedSummaries) {
    gatedSeverityCounts[f.severity] = (gatedSeverityCounts[f.severity] || 0) + 1;
  }
  const severityBreakdown = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    .filter((s) => gatedSeverityCounts[s])
    .map((s) => `${gatedSeverityCounts[s]} ${s.charAt(0) + s.slice(1).toLowerCase()}`)
    .join(", ");

  // Build fix difficulty counts for dynamic CTA
  const fixDifficultyCounts: Record<string, number> = {};
  for (const f of gatedSummaries) {
    if (f.fix_difficulty) {
      fixDifficultyCounts[f.fix_difficulty] = (fixDifficultyCounts[f.fix_difficulty] || 0) + 1;
    }
  }
  // Pick the most compelling difficulty to highlight (easy first, then moderate)
  const fixCtaPart = fixDifficultyCounts.easy
    ? `and apply ${fixDifficultyCounts.easy} easy ${fixDifficultyCounts.easy === 1 ? "fix" : "fixes"}`
    : fixDifficultyCounts.moderate
      ? `and apply ${fixDifficultyCounts.moderate} moderate ${fixDifficultyCounts.moderate === 1 ? "fix" : "fixes"}`
      : fixDifficultyCounts.complex
        ? `and apply ${fixDifficultyCounts.complex} ${fixDifficultyCounts.complex === 1 ? "fix" : "fixes"}`
        : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      {/* Contextual value banner — below header, above content */}
      {!loading && report && !isSignedIn && hasGatedFindings && (
        <div className="w-full border-b border-border bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Viewing preview
              </span>
              {" — "}
              {gatedSummaries.length} {gatedSummaries.length === 1 ? "finding" : "findings"}, governance details, and remediation code locked.
            </p>
            <Button
              size="sm"
              className="h-8 shrink-0"
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
              Unlock Full Report
            </Button>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Security Report
            </h1>
            <p className="text-muted-foreground">
              <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono break-all">
                {report.repo_name}
              </code>
              <span className="ml-2 text-xs whitespace-nowrap">
                Scanned{" "}
                {new Date(report.scanned_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0 self-start">
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

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-2">
          <SecurityMetricCard
            title="Total Findings"
            value={result.findings_count}
            icon={FileText}
            variant={result.findings_count > 0 ? "warning" : "success"}
          />
          <SecurityMetricCard
            title="Critical"
            value={result.critical_count}
            icon={AlertTriangle}
            variant={result.critical_count > 0 ? "danger" : "success"}
          />
          <SecurityMetricCard
            title="Risk Score"
            value={`${result.risk_score}/100`}
            icon={Activity}
            variant={
              result.risk_score >= 70
                ? "danger"
                : result.risk_score >= 40
                  ? "warning"
                  : "success"
            }
          />
          <SecurityMetricCard
            title="Governance"
            value={`${result.governance_score}/100`}
            icon={Shield}
            variant={
              result.governance_score >= 70
                ? "success"
                : result.governance_score >= 40
                  ? "warning"
                  : "danger"
            }
          />
        </div>
        <p className="text-[11px] text-muted-foreground/70 mb-8 px-0.5">
          <strong>Risk Score</strong>: Weighted severity of vulnerabilities found (0 = no risk, 100 = critical).{" "}
          <strong>Governance</strong>: Coverage of human oversight, authorization, and audit controls per{" "}
          <a href="https://docs.inkog.io/core-concepts/scoring" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
            EU AI Act & OWASP
          </a>.
        </p>

        {/* Zero findings — success state */}
        {!hasFindings && (
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

        {/* Security Strengths — positive signals build trust before vulnerabilities */}
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

        {/* Full-detail findings (always visible) */}
        {fullFindings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {hasGatedFindings ? "Top Findings" : "Findings"}
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

                      {/* Explanation trace — terminal-style */}
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

                      {/* Remediation — backend-provided */}
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

        {/* Gated findings — server-side gated, no detail data in the DOM */}
        {hasGatedFindings && (
          <div className="mb-8">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Summary list — text only, no FindingCard components */}
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

              {/* Minimal text rows — severity + title only, no exploitable data */}
              <div className="divide-y divide-border">
                {gatedSummaries.map((item) => {
                  const title = item.display_title
                    || item.pattern_id.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                  const sevColors: Record<string, string> = {
                    CRITICAL: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
                    HIGH: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                    MEDIUM: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                    LOW: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                  };
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded border ${sevColors[item.severity] || sevColors.LOW}`}
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

              {/* Conversion CTA */}
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

        {/* Scan your own repo CTA */}
        <div className="mt-4 mb-8 bg-card rounded-xl border border-border p-6 sm:p-8 text-center">
          <div className="max-w-lg mx-auto">
            <GitBranch className="w-6 h-6 text-brand mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Scan your own repositories
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Install the Inkog GitHub App to automatically scan every push.
              Get security reports on pull requests.
            </p>
            <Button
              variant="outline"
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
  );
}

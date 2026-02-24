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
} from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { FindingCard } from "@/components/FindingCard";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { CodeSnippetDisplay } from "@/components/CodeSnippetDisplay";
import { GovernanceScore } from "@/components/GovernanceScore";
import { SecurityMetricCard } from "@/components/dashboard/SecurityMetricCard";
import { Button } from "@/components/ui/button";
import { getPatternLabel } from "@/lib/patternLabels";
import { getRemediationGuide } from "@/lib/remediationGuides";
import {
  trackReportViewed,
  trackPaywallAuthClicked,
  trackReportShared,
} from "@/lib/analytics-public";
import type { ScanResult, Finding } from "@/lib/api";

interface ReportData {
  report_id: string;
  repo_name: string;
  repo_url: string;
  scan_result: ScanResult;
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
              Report expired or not found
            </h1>
            <p className="text-muted-foreground mb-6">
              Reports are available for 48 hours. You can run a new scan to
              generate a fresh report.
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
  const sortedFindings = [...(result.findings || [])].sort((a, b) => {
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    if (sevDiff !== 0) return sevDiff;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const firstFinding = sortedFindings[0] ?? null;
  const remainingFindings = sortedFindings.slice(1);
  const firstRemediation = firstFinding
    ? getRemediationGuide(firstFinding.pattern_id)
    : null;
  const firstLabel = firstFinding
    ? getPatternLabel(firstFinding.pattern_id)
    : null;

  const hasFindings = sortedFindings.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Security Report
            </h1>
            <p className="text-muted-foreground">
              <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                {report.repo_name}
              </code>
              <span className="ml-2 text-xs">
                Scanned{" "}
                {new Date(report.scanned_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              Great news! The balanced scan policy found no security issues in
              this repository.
            </p>
          </div>
        )}

        {/* First finding — always visible */}
        {firstFinding && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Top Finding
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <FindingCard
                finding={firstFinding}
                onClick={() => {
                  if (isSignedIn) {
                    setSelectedFinding(firstFinding);
                    setDetailsOpen(true);
                  }
                }}
              />

              {/* Expanded inline detail for the first finding */}
              <div className="px-6 pb-6 border-t border-border">
                {/* Description */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    {firstFinding.message}
                  </p>
                </div>

                {/* Code snippet */}
                {firstFinding.code_snippet && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      Code
                    </h3>
                    <CodeSnippetDisplay
                      code={firstFinding.code_snippet}
                      file={firstFinding.file}
                      highlightLine={firstFinding.line}
                    />
                  </div>
                )}

                {/* Remediation */}
                {firstRemediation && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      How to Fix
                    </h3>
                    <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-2">
                        {firstRemediation.title}
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {firstRemediation.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Compliance tags */}
                {firstFinding.compliance_mapping && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {firstFinding.compliance_mapping.eu_ai_act_articles?.map(
                      (article) => (
                        <span
                          key={article}
                          className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800"
                        >
                          EU AI Act: {article}
                        </span>
                      )
                    )}
                    {firstFinding.compliance_mapping.owasp_items?.map(
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
          </div>
        )}

        {/* Remaining findings — gated behind auth */}
        {remainingFindings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              All Findings ({sortedFindings.length})
            </h2>

            {isSignedIn ? (
              /* Unblurred — full access */
              <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                {remainingFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onClick={() => {
                      setSelectedFinding(finding);
                      setDetailsOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              /* Blurred paywall */
              <div className="relative">
                <div className="select-none pointer-events-none bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {remainingFindings.slice(0, 5).map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onClick={() => {}}
                    />
                  ))}
                </div>

                {/* Blur overlay */}
                <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-xl flex items-center justify-center">
                  <div className="text-center max-w-md px-6">
                    <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-6 h-6 text-brand" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {remainingFindings.length} more{" "}
                      {remainingFindings.length === 1
                        ? "vulnerability"
                        : "vulnerabilities"}{" "}
                      found
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create a free account to unlock the full report.
                    </p>

                    {/* Benefit chips */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                        <Key className="w-3 h-3" /> API keys & CLI access
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                        <GitBranch className="w-3 h-3" /> GitHub auto-scanning
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground">
                        <Settings2 className="w-3 h-3" /> Custom scan policies
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => {
                          trackPaywallAuthClicked({
                            report_id: reportId,
                            findings_hidden: remainingFindings.length,
                            auth_method: "sign_up",
                          });
                          router.push(
                            `/sign-up?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                          );
                        }}
                      >
                        Get Started Free
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          trackPaywallAuthClicked({
                            report_id: reportId,
                            findings_hidden: remainingFindings.length,
                            auth_method: "sign_in",
                          });
                          router.push(
                            `/sign-in?redirect_url=${encodeURIComponent(`/report/${reportId}`)}`
                          );
                        }}
                      >
                        Already have an account? Sign In
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              articleMapping={result.article_mapping}
              frameworkMapping={result.framework_mapping}
            />
          </div>
        )}
      </main>

      {/* Finding details slide-out (authenticated only) */}
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

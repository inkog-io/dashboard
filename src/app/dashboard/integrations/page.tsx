"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Github,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plus,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Clock,
  Settings,
  Play,
  Loader2,
  Shield,
  BarChart3,
  Activity,
  Building2,
  User,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SecurityMetricCard } from "@/components/dashboard/SecurityMetricCard";
import { createAPIClient } from "@/lib/api";
import { cn } from "@/lib/utils";

const GITHUB_APP_INSTALL_URL =
  "https://github.com/apps/inkog-scanner/installations/new";

// ─── Scan Progress Stages ───────────────────────────────────────────────────

const SCAN_STAGES = [
  { key: "connecting", label: "Connecting to GitHub", threshold: 0 },
  { key: "cloning", label: "Cloning repository", threshold: 3 },
  { key: "analyzing", label: "Running security analysis", threshold: 12 },
  { key: "processing", label: "Processing results", threshold: 60 },
] as const;

function ScanProgress({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [startTime]);

  // Determine current stage based on elapsed time
  let currentStageIndex = 0;
  for (let i = SCAN_STAGES.length - 1; i >= 0; i--) {
    if (elapsed >= SCAN_STAGES[i].threshold) {
      currentStageIndex = i;
      break;
    }
  }

  // Smooth progress: each stage takes up 25% of the bar
  const stageProgress = (() => {
    const stage = SCAN_STAGES[currentStageIndex];
    const nextThreshold = SCAN_STAGES[currentStageIndex + 1]?.threshold ?? 120;
    const stageElapsed = elapsed - stage.threshold;
    const stageDuration = nextThreshold - stage.threshold;
    return Math.min(stageElapsed / stageDuration, 0.95); // Never quite fill the segment
  })();

  const totalProgress = Math.min(
    ((currentStageIndex + stageProgress) / SCAN_STAGES.length) * 100,
    95 // Never hit 100% until actually done
  );

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="space-y-2 py-1">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Stage label + timer */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          {SCAN_STAGES[currentStageIndex].label}...
        </span>
        <span className="text-muted-foreground/60 tabular-nums">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Stage dots */}
      <div className="flex items-center gap-1">
        {SCAN_STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1">
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                i < currentStageIndex
                  ? "bg-blue-500"
                  : i === currentStageIndex
                    ? "bg-blue-500 animate-pulse"
                    : "bg-muted-foreground/20"
              )}
            />
            {i < SCAN_STAGES.length - 1 && (
              <div
                className={cn(
                  "h-px w-3 transition-colors duration-300",
                  i < currentStageIndex ? "bg-blue-500" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface RepoStats {
  name: string;
  scan_count: number;
  last_scan_at: string | null;
  last_scan_id: string | null;
  findings_count: number;
  critical_count: number;
  high_count: number;
  status: "passing" | "warning" | "failing" | "pending";
}

interface Installation {
  id: number;
  account: string;
  account_type: string;
  created_at: string;
  total_scans: number;
  repos: RepoStats[];
}

// ─── Presentational Components ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { icon: typeof CheckCircle2; color: string; label: string }
  > = {
    passing: {
      icon: CheckCircle2,
      color:
        "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30",
      label: "Passing",
    },
    failing: {
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
      label: "Failing",
    },
    warning: {
      icon: AlertTriangle,
      color:
        "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
      label: "Warning",
    },
    pending: {
      icon: Clock,
      color:
        "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50",
      label: "Pending",
    },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        c.color
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute h-full w-full rounded-full bg-gray-400 opacity-75" />
        <span className="relative rounded-full h-2 w-2 bg-gray-500" />
      </span>
      Awaiting first scan
    </span>
  );
}

function FindingsBadges({ repo }: { repo: RepoStats }) {
  if (repo.scan_count === 0) {
    return <span className="text-muted-foreground">--</span>;
  }

  if (repo.findings_count === 0) {
    return (
      <span className="text-green-600 dark:text-green-400 font-medium">0</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium">{repo.findings_count}</span>
      {repo.critical_count > 0 && (
        <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none">
          {repo.critical_count}C
        </span>
      )}
      {repo.high_count > 0 && (
        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none">
          {repo.high_count}H
        </span>
      )}
    </div>
  );
}

function getInstallationStatus(installation: Installation): string {
  if (installation.repos.some((r) => r.status === "failing")) return "failing";
  if (installation.repos.some((r) => r.status === "warning")) return "warning";
  if (installation.total_scans > 0) return "passing";
  return "pending";
}

// ─── Installation Card ──────────────────────────────────────────────────────

function InstallationCard({
  installation,
  expanded,
  onToggle,
  scanningRepos,
  scanStartTimes,
  completedRepos,
  scanErrors,
  onScanRepo,
}: {
  installation: Installation;
  expanded: boolean;
  onToggle: () => void;
  scanningRepos: Record<string, boolean>;
  scanStartTimes: Record<string, number>;
  completedRepos: Set<string>;
  scanErrors: Record<string, string>;
  onScanRepo: (installationId: number, repoName: string) => void;
}) {
  const router = useRouter();
  const status = getInstallationStatus(installation);
  const AccountIcon =
    installation.account_type === "Organization" ? Building2 : User;

  const configureUrl =
    installation.account_type === "Organization"
      ? `https://github.com/organizations/${installation.account}/settings/installations/${installation.id}`
      : `https://github.com/settings/installations/${installation.id}`;

  const repoSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      `${installation.repos.length} ${installation.repos.length === 1 ? "repository" : "repositories"}`
    );
    if (installation.total_scans > 0) {
      parts.push(
        `${installation.total_scans} ${installation.total_scans === 1 ? "scan" : "scans"}`
      );
    }
    return parts.join(" \u00B7 ");
  }, [installation]);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="rounded-lg bg-muted p-2">
              <Github className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">
                  {installation.account}
                </CardTitle>
                <AccountIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground">{repoSummary}</p>
                <span className="text-muted-foreground/50">&middot;</span>
                <p className="text-xs text-muted-foreground/70">
                  Connected{" "}
                  {formatDistanceToNow(new Date(installation.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <Button
              variant="ghost"
              size="sm"
              asChild
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <a
                href={configureUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Settings className="h-4 w-4 mr-1.5" />
                Configure
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="border-t pt-4">
            {installation.repos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No repositories configured. Add repositories in{" "}
                <a
                  href={configureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  GitHub App settings
                </a>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead className="text-center">Scans</TableHead>
                    <TableHead className="text-center">Findings</TableHead>
                    <TableHead>Last Scan</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[140px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installation.repos.map((repo) => {
                    const isScanning = scanningRepos[repo.name] || false;
                    const scanStartTime = scanStartTimes[repo.name];
                    const justCompleted = completedRepos.has(repo.name);
                    const scanError = scanErrors[repo.name];
                    const hasResults = repo.last_scan_id != null;

                    return (
                      <TableRow
                        key={repo.name}
                        className={cn(
                          "transition-colors duration-700",
                          justCompleted && "bg-green-50 dark:bg-green-900/10",
                          hasResults && !isScanning
                            ? "cursor-pointer hover:bg-muted/50"
                            : ""
                        )}
                        onClick={() => {
                          if (hasResults && !isScanning) {
                            router.push(
                              `/dashboard/results/${repo.last_scan_id}`
                            );
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium">
                                {repo.name.split("/")[1] || repo.name}
                              </span>
                              {/* Scan progress indicator — inline below repo name */}
                              {isScanning && scanStartTime && (
                                <div className="mt-1.5 max-w-[240px]">
                                  <ScanProgress startTime={scanStartTime} />
                                </div>
                              )}
                              {/* Scan completion flash */}
                              {justCompleted && !isScanning && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Scan complete
                                </p>
                              )}
                              {scanError && (
                                <p className="text-xs text-red-500 mt-0.5">
                                  {scanError}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {repo.scan_count || "--"}
                        </TableCell>
                        <TableCell className="text-center">
                          <FindingsBadges repo={repo} />
                        </TableCell>
                        <TableCell>
                          {repo.last_scan_at ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(repo.last_scan_at),
                                { addSuffix: true }
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Never
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isScanning ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Scanning
                            </span>
                          ) : repo.status === "pending" ? (
                            <PendingBadge />
                          ) : (
                            <StatusBadge status={repo.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isScanning ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-50"
                            >
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </Button>
                          ) : !hasResults ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScanRepo(installation.id, repo.name);
                              }}
                            >
                              <Play className="h-3.5 w-3.5 mr-1.5" />
                              Scan Now
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScanRepo(installation.id, repo.name);
                              }}
                              title="Re-scan repository"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              Rescan
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<ReturnType<typeof createAPIClient> | null>(
    null
  );
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan state
  const [scanningRepos, setScanningRepos] = useState<
    Record<string, boolean>
  >({});
  const [scanStartTimes, setScanStartTimes] = useState<
    Record<string, number>
  >({});
  const [completedRepos, setCompletedRepos] = useState<Set<string>>(
    new Set()
  );
  const [scanErrors, setScanErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setApi(createAPIClient(getToken));
  }, [getToken]);

  const fetchInstallations = useCallback(
    async (isRefresh = false) => {
      if (!api) return;
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);
        const response = await api.github.listInstallations();
        setInstallations(response.installations as Installation[]);
        if (response.installations.length === 1) {
          setExpandedId(response.installations[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load GitHub installations"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  const handleScanRepo = useCallback(
    async (installationId: number, repoName: string) => {
      if (!api || scanningRepos[repoName]) return;

      // Start scan with timestamp for progress tracking
      setScanningRepos((prev) => ({ ...prev, [repoName]: true }));
      setScanStartTimes((prev) => ({ ...prev, [repoName]: Date.now() }));
      setScanErrors((prev) => {
        const next = { ...prev };
        delete next[repoName];
        return next;
      });

      try {
        await api.github.triggerScan({
          installation_id: installationId,
          repo_full_name: repoName,
        });

        // Flash green on completion
        setCompletedRepos((prev) => new Set(prev).add(repoName));
        setTimeout(() => {
          setCompletedRepos((prev) => {
            const next = new Set(prev);
            next.delete(repoName);
            return next;
          });
        }, 4000);

        // Refresh data to show new results
        await fetchInstallations(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Scan failed";
        const friendlyMessage = message.includes("busy")
          ? "Scanner is busy — try again in a moment"
          : message.includes("unavailable")
            ? "Scanner is currently unavailable"
            : message.includes("in progress") || message.includes("in_progress")
              ? "A scan is already running for this repository"
              : message.includes("permission") || message.includes("access")
                ? "Failed to scan — check repository permissions"
                : message.includes("timed out") || message.includes("timeout")
                  ? "Scan timed out — the repository may be too large"
                  : `Scan failed: ${message}`;
        setScanErrors((prev) => ({ ...prev, [repoName]: friendlyMessage }));
      } finally {
        setScanningRepos((prev) => ({ ...prev, [repoName]: false }));
        setScanStartTimes((prev) => {
          const next = { ...prev };
          delete next[repoName];
          return next;
        });
      }
    },
    [api, fetchInstallations, scanningRepos]
  );

  // Compute summary stats
  const stats = useMemo(() => {
    const allRepos = installations.flatMap((i) => i.repos);
    const totalRepos = allRepos.length;
    const totalScans = installations.reduce(
      (sum, i) => sum + i.total_scans,
      0
    );

    const hasFailures = allRepos.some((r) => r.status === "failing");
    const hasWarnings = allRepos.some((r) => r.status === "warning");
    const hasPassing = allRepos.some((r) => r.status === "passing");
    const allPending = allRepos.every((r) => r.status === "pending");

    let posture: {
      label: string;
      variant: "success" | "warning" | "danger" | "default";
    } = { label: "Pending", variant: "default" };
    if (hasFailures) {
      posture = { label: "Failing", variant: "danger" };
    } else if (hasWarnings) {
      posture = { label: "Warning", variant: "warning" };
    } else if (hasPassing) {
      posture = { label: "Passing", variant: "success" };
    } else if (allPending && totalRepos > 0) {
      posture = { label: "Pending", variant: "default" };
    }

    const scanDates = allRepos
      .filter((r) => r.last_scan_at)
      .map((r) => new Date(r.last_scan_at!).getTime());
    const lastActivity =
      scanDates.length > 0
        ? formatDistanceToNow(new Date(Math.max(...scanDates)), {
            addSuffix: true,
          })
        : "Never";

    return { totalRepos, totalScans, posture, lastActivity };
  }, [installations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            GitHub Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage GitHub App installations and repository connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInstallations(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Button asChild>
            <a
              href={GITHUB_APP_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Installation
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Error with retry */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInstallations()}
              className="ml-4 flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading installations...
            </p>
          </CardContent>
        </Card>
      ) : installations.length === 0 && !error ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Github className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No GitHub installations yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Connect the Inkog GitHub App to automatically scan pull requests
              for security vulnerabilities.
            </p>

            <div className="w-full max-w-sm text-left space-y-3 mb-6">
              {[
                {
                  step: 1,
                  title: "Install GitHub App",
                  desc: "Choose your organization or personal account",
                },
                {
                  step: 2,
                  title: "Select Repositories",
                  desc: "Choose which repos to scan (all or specific ones)",
                },
                {
                  step: 3,
                  title: "Automatic Scanning",
                  desc: "PRs are scanned automatically with inline comments",
                },
              ].map(({ step, title, desc }) => (
                <div
                  key={step}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      step === 1
                        ? "bg-foreground text-background"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button asChild>
              <a
                href={GITHUB_APP_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                Install GitHub App
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : installations.length > 0 ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SecurityMetricCard
              title="Connected Repos"
              value={stats.totalRepos}
              icon={GitBranch}
              variant="info"
              tooltip="Total repositories connected via GitHub App"
            />
            <SecurityMetricCard
              title="Total Scans"
              value={stats.totalScans}
              icon={BarChart3}
              variant="default"
              tooltip="Cumulative scans across all repos"
            />
            <SecurityMetricCard
              title="Security Posture"
              value={stats.posture.label}
              icon={Shield}
              variant={stats.posture.variant}
              tooltip="Aggregate security status across all repos"
            />
            <SecurityMetricCard
              title="Last Activity"
              value={stats.lastActivity}
              icon={Activity}
              variant="default"
              tooltip="Most recent scan activity"
            />
          </div>

          {/* Installation list */}
          <div className="space-y-4">
            {installations.map((installation) => (
              <InstallationCard
                key={installation.id}
                installation={installation}
                expanded={expandedId === installation.id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === installation.id ? null : installation.id
                  )
                }
                scanningRepos={scanningRepos}
                scanStartTimes={scanStartTimes}
                completedRepos={completedRepos}
                scanErrors={scanErrors}
                onScanRepo={handleScanRepo}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

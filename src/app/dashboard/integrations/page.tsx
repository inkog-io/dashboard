"use client";

import { useState, useEffect, useCallback } from "react";
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
import { createAPIClient } from "@/lib/api";
import { cn } from "@/lib/utils";

const GITHUB_APP_INSTALL_URL =
  "https://github.com/apps/inkog-scanner/installations/new";

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

function getInstallationStatus(installation: Installation): string {
  if (installation.repos.some((r) => r.status === "failing")) return "failing";
  if (installation.repos.some((r) => r.status === "warning")) return "warning";
  if (installation.total_scans > 0) return "passing";
  return "pending";
}

function InstallationCard({
  installation,
  expanded,
  onToggle,
}: {
  installation: Installation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const status = getInstallationStatus(installation);

  // Build the configure URL based on account type
  const configureUrl =
    installation.account_type === "Organization"
      ? `https://github.com/organizations/${installation.account}/settings/installations/${installation.id}`
      : `https://github.com/settings/installations/${installation.id}`;

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
                <CardTitle className="text-lg">{installation.account}</CardTitle>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {installation.account_type}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {installation.repos.length}{" "}
                {installation.repos.length === 1 ? "repository" : "repositories"}
                {installation.total_scans > 0 &&
                  ` · ${installation.total_scans} scan${installation.total_scans !== 1 ? "s" : ""}`}
              </p>
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
              <a href={configureUrl} target="_blank" rel="noopener noreferrer">
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
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installation.repos.map((repo) => (
                    <TableRow
                      key={repo.name}
                      className={cn(
                        "transition-colors",
                        repo.last_scan_id
                          ? "cursor-pointer hover:bg-muted/50"
                          : "opacity-60"
                      )}
                      onClick={() => {
                        if (repo.last_scan_id) {
                          router.push(`/dashboard/results/${repo.last_scan_id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {repo.name.split("/")[1] || repo.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {repo.scan_count || "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {repo.findings_count > 0 ? (
                          <span className="font-medium">
                            {repo.findings_count}
                            {(repo.critical_count > 0 ||
                              repo.high_count > 0) && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({repo.critical_count}C/{repo.high_count}H)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {repo.last_scan_at ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(repo.last_scan_at), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={repo.status} />
                      </TableCell>
                      <TableCell>
                        {repo.last_scan_id && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

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
        // Auto-expand if there's only one installation
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

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
          </CardContent>
        </Card>
      ) : installations.length === 0 ? (
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

            {/* Getting started steps */}
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
      ) : (
        /* Installation list */
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  History,
  FileSearch,
  AlertTriangle,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Upload,
  Terminal,
  Loader2,
  Bot,
  Shield,
  Trash2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
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

import {
  createAPIClient,
  type Scan,
  type ScanSummary,
  type InkogAPI,
  type PaginationMeta,
} from "@/lib/api";

import {
  HistoryFilters,
  HistoryExport,
  SortableHeader,
  Pagination,
  type FilterState,
} from "@/components/history";
import {
  getPendingDeepScans,
  removePendingDeepScan,
  type PendingDeepScan,
} from "@/lib/pending-deep-scans";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function HistoryPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, canAccessDeepScan } = useCurrentUser();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    page_size: 25,
    total_items: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingScans, setPendingScans] = useState<PendingDeepScan[]>([]);
  const pendingPollRef = useRef<NodeJS.Timeout | null>(null);
  const [deleteScanId, setDeleteScanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // State from URL params
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort_by") || "date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("sort_order") as "asc" | "desc") || "desc"
  );
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get("search") || "",
    dateFrom: searchParams.get("date_from") || "",
    dateTo: searchParams.get("date_to") || "",
    severity: searchParams.get("severity") || "",
  });

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Sync state to URL
  const updateURL = useCallback(
    (
      newPage: number,
      newSortBy: string,
      newSortOrder: "asc" | "desc",
      newFilters: FilterState
    ) => {
      const params = new URLSearchParams();
      if (newPage > 1) params.set("page", newPage.toString());
      if (newSortBy !== "date") params.set("sort_by", newSortBy);
      if (newSortOrder !== "desc") params.set("sort_order", newSortOrder);
      if (newFilters.search) params.set("search", newFilters.search);
      if (newFilters.dateFrom) params.set("date_from", newFilters.dateFrom);
      if (newFilters.dateTo) params.set("date_to", newFilters.dateTo);
      if (newFilters.severity) params.set("severity", newFilters.severity);

      const query = params.toString();
      router.replace(`/dashboard/history${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router]
  );

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.history.listPaginated({
        page,
        page_size: 25,
        sort_by: sortBy as "date" | "risk_score" | "findings_count",
        sort_order: sortOrder,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        severity: filters.severity as "critical" | "high" | "medium" | "low" | undefined,
        search: filters.search || undefined,
        summary: true,
      });

      setScans(response.scans || []);
      setPagination(response.pagination);
      if (response.summary) {
        setSummary(response.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan history");
    } finally {
      setLoading(false);
    }
  }, [api, page, sortBy, sortOrder, filters]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll pending deep scans
  useEffect(() => {
    if (!api || !canAccessDeepScan) return;

    // Load initial pending scans
    setPendingScans(getPendingDeepScans());

    const poll = async () => {
      const current = getPendingDeepScans();
      if (current.length === 0) {
        setPendingScans([]);
        return;
      }

      let changed = false;
      for (const pending of current) {
        try {
          const data = await api.deepScan.getStatus(pending.scanId);
          if (data.status === "completed" || data.status === "failed") {
            removePendingDeepScan(pending.scanId);
            changed = true;
          }
        } catch {
          // Ignore transient errors
        }
      }

      if (changed) {
        setPendingScans(getPendingDeepScans());
        fetchHistory();
      }
    };

    pendingPollRef.current = setInterval(poll, 15_000);
    return () => {
      if (pendingPollRef.current) clearInterval(pendingPollRef.current);
    };
  }, [api, canAccessDeepScan, fetchHistory]);

  // Cross-tab sync via StorageEvent
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "inkog-pending-deep-scans") {
        setPendingScans(getPendingDeepScans());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Handlers
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateURL(newPage, sortBy, sortOrder, filters);
  };

  const handleSort = (key: string, order: "asc" | "desc") => {
    setSortBy(key);
    setSortOrder(order);
    setPage(1); // Reset to first page on sort change
    updateURL(1, key, order, filters);
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
    updateURL(1, sortBy, sortOrder, newFilters);
  };

  // Pending scans take priority: hide API rows that are still processing
  const pendingScanIds = new Set(pendingScans.map((p) => p.scanId));
  const visibleScans = scans.filter((s) => !pendingScanIds.has(s.id));
  const visiblePendingScans = pendingScans;

  // Merge pending + API rows into a single sorted list
  type MergedRow =
    | { kind: "scan"; data: Scan }
    | { kind: "pending"; data: PendingDeepScan };

  const mergedRows: MergedRow[] = [
    ...visibleScans.map((s): MergedRow => ({ kind: "scan", data: s })),
    ...(canAccessDeepScan
      ? visiblePendingScans.map((p): MergedRow => ({ kind: "pending", data: p }))
      : []),
  ].sort((a, b) => {
    const dateA = a.kind === "scan" ? a.data.created_at : a.data.startedAt;
    const dateB = b.kind === "scan" ? b.data.created_at : b.data.startedAt;
    const cmp = new Date(dateA).getTime() - new Date(dateB).getTime();
    return sortOrder === "desc" ? -cmp : cmp;
  });

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if a deep scan is in error/incomplete state
  const isErrorDeepScan = (scan: Scan) =>
    scan.scan_policy === "deep-checks" && scan.files_scanned === 0 && scan.findings_count <= 0;

  // Handle delete scan
  const handleDeleteScan = async () => {
    if (!api || !deleteScanId) return;
    setDeleting(true);
    try {
      const scanToDelete = scans.find(s => s.id === deleteScanId);
      if (scanToDelete?.scan_type === 'skill') {
        await api.skills.delete(deleteScanId);
      } else {
        await api.scans.delete(deleteScanId);
      }
      setDeleteScanId(null);
      fetchHistory();
    } catch {
      // Deletion failed — close dialog, row stays
      setDeleteScanId(null);
    } finally {
      setDeleting(false);
    }
  };

  // Get scan status badge
  const getScanStatusBadge = (scan: Scan) => {
    if (scan.findings_count === -1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    }
    if (isErrorDeepScan(scan) || scan.risk_score === -2) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    }
    if (scan.scan_type === 'skill' && scan.ai_scan_status === 'processing') {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Deep Processing
          </span>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <CheckCircle className="h-3 w-3" />
        Completed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Scan History
          </h1>
          <p className="text-muted-foreground mt-1">
            View and analyze your security scan results.{" "}
            <a href="https://docs.inkog.io/core-concepts/scoring" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/60 hover:text-primary transition-colors">
              Scoring guide &rarr;
            </a>
          </p>
        </div>
        <HistoryExport scans={scans} loading={loading} />
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="dark:bg-card dark:border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Scans</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {summary.total_scans}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-card dark:border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Files Scanned</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {summary.total_files_scanned.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-card dark:border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Findings</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {summary.total_findings}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-card dark:border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Risk Score</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {summary.average_risk_score.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <HistoryFilters onFiltersChange={handleFiltersChange} loading={loading} />

      {/* Scan History Table */}
      <Card className="dark:bg-card dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Recent Scans
          </CardTitle>
          <CardDescription className="dark:text-muted-foreground">
            Click a scan to view detailed results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
            </div>
          ) : visibleScans.length === 0 && visiblePendingScans.length === 0 ? (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                No scans found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filters.search || filters.dateFrom || filters.dateTo || filters.severity
                  ? "Try adjusting your filters"
                  : "Run your first scan to see results here."}
              </p>
              {!filters.search && !filters.dateFrom && !filters.dateTo && !filters.severity && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <code className="bg-muted px-3 py-2 rounded text-sm text-foreground">
                      inkog scan ./your-agent
                    </code>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>or</span>
                    <Link
                      href="/dashboard/scan"
                      className="inline-flex items-center gap-1.5 text-foreground hover:underline font-medium"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      upload files directly
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-border">
                    <TableHead className="dark:text-muted-foreground">
                      <SortableHeader
                        label="Date"
                        sortKey="date"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-muted-foreground">Agent</TableHead>
                    <TableHead className="dark:text-muted-foreground">Files</TableHead>
                    <TableHead className="dark:text-muted-foreground">
                      <SortableHeader
                        label="Findings"
                        sortKey="findings_count"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-muted-foreground">
                      <SortableHeader
                        label="Risk Score"
                        sortKey="risk_score"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-muted-foreground">
                      <SortableHeader
                        label="Governance"
                        sortKey="governance_score"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-muted-foreground">Duration</TableHead>
                    <TableHead className="dark:text-muted-foreground">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedRows.map((row) =>
                    row.kind === "pending" ? (
                      <TableRow
                        key={`pending-${row.data.scanId}`}
                        className="dark:border-border bg-blue-50/50 dark:bg-blue-900/10"
                      >
                        <TableCell className="text-muted-foreground">
                          {formatDate(row.data.startedAt)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Bot className="h-4 w-4" />
                            {row.data.agentName}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">--</TableCell>
                        <TableCell className="text-muted-foreground">--</TableCell>
                        <TableCell className="text-muted-foreground">--</TableCell>
                        <TableCell className="text-muted-foreground">--</TableCell>
                        <TableCell className="text-muted-foreground">--</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </span>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ) : (
                      <TableRow
                        key={row.data.id}
                        className="dark:border-border hover:bg-accent cursor-pointer group"
                        onClick={() => {
                          if (row.data.scan_type === 'skill') {
                            router.push(`/dashboard/skills/${row.data.id}`);
                          } else {
                            router.push(`/dashboard/results/${row.data.id}`);
                          }
                        }}
                      >
                        <TableCell className="text-muted-foreground">
                          {formatDate(row.data.created_at)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          <div className="flex flex-col gap-1">
                            {row.data.scan_type === 'skill' ? (
                              <>
                                <span className="truncate max-w-[200px] flex items-center gap-1.5">
                                  <Shield className="h-4 w-4 text-blue-500" />
                                  {row.data.agent_name || 'Skill Scan'}
                                </span>
                                <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                  Skill Scan
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="truncate max-w-[200px]">
                                  {row.data.agent_name || <span className="text-muted-foreground italic">Unnamed</span>}
                                </span>
                                {row.data.scan_policy === "deep-checks" ? (
                                  <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                    Inkog Deep
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    Inkog Core
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        {row.data.findings_count === -1 ? (
                          <>
                            <TableCell className="text-muted-foreground">--</TableCell>
                            <TableCell className="text-muted-foreground">--</TableCell>
                            <TableCell className="text-muted-foreground">--</TableCell>
                            <TableCell className="text-muted-foreground">--</TableCell>
                            <TableCell className="text-muted-foreground">--</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="dark:text-foreground">
                              {row.data.files_scanned}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium dark:text-foreground">
                                {row.data.findings_count}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-medium ${
                                  row.data.risk_score >= 80
                                    ? "text-red-600 dark:text-red-400"
                                    : row.data.risk_score >= 50
                                    ? "text-orange-600 dark:text-orange-400"
                                    : row.data.risk_score >= 30
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-green-600 dark:text-green-400"
                                }`}
                              >
                                {row.data.risk_score}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-medium ${
                                  (row.data.governance_score ?? 0) >= 80
                                    ? "text-green-600 dark:text-green-400"
                                    : (row.data.governance_score ?? 0) >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {row.data.governance_score ?? "--"}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.data.duration_ms === 0
                                ? "--"
                                : row.data.duration_ms >= 1000
                                ? `${(row.data.duration_ms / 1000).toFixed(1)}s`
                                : `${row.data.duration_ms}ms`}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          {getScanStatusBadge(row.data)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.data.user_id === user?.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteScanId(row.data.id);
                                }}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete scan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="border-t border-border mt-4">
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.page_size}
                  totalItems={pagination.total_items}
                  totalPages={pagination.total_pages}
                  onPageChange={handlePageChange}
                  loading={loading}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteScanId}
        onOpenChange={(open) => { if (!open) setDeleteScanId(null); }}
        onConfirm={handleDeleteScan}
        title="Delete scan"
        description="This will permanently delete this scan and its results. This action cannot be undone."
        confirmLabel="Delete scan"
        loading={deleting}
      />
    </div>
  );
}

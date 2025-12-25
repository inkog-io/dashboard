"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  History,
  FileSearch,
  AlertTriangle,
  Clock,
  AlertCircle,
  ChevronRight,
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

export default function HistoryPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Get severity badge
  const getSeverityBadge = (critical: number, high: number, findings: number) => {
    if (critical > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          Critical: {critical}
        </span>
      );
    }
    if (high > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
          High: {high}
        </span>
      );
    }
    if (findings > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        Clean
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Scan History
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and analyze your security scan results
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
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Scans</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.total_scans}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Files Scanned</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.total_files_scanned.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Findings</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.total_findings}
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Avg Risk Score</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.average_risk_score.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <HistoryFilters onFiltersChange={handleFiltersChange} loading={loading} />

      {/* Scan History Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <History className="h-5 w-5" />
            Recent Scans
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Click a scan to view detailed results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                No scans found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {filters.search || filters.dateFrom || filters.dateTo || filters.severity
                  ? "Try adjusting your filters"
                  : "Run your first scan with the CLI to see results here."}
              </p>
              {!filters.search && !filters.dateFrom && !filters.dateTo && !filters.severity && (
                <div className="mt-4">
                  <code className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm text-gray-800 dark:text-gray-200">
                    inkog scan -path ./your-agent
                  </code>
                </div>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-700">
                    <TableHead className="dark:text-gray-400">
                      <SortableHeader
                        label="Date"
                        sortKey="date"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-gray-400">Files</TableHead>
                    <TableHead className="dark:text-gray-400">
                      <SortableHeader
                        label="Findings"
                        sortKey="findings_count"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-gray-400">
                      <SortableHeader
                        label="Risk Score"
                        sortKey="risk_score"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="dark:text-gray-400">Duration</TableHead>
                    <TableHead className="dark:text-gray-400">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((scan) => (
                    <TableRow
                      key={scan.id}
                      className="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                      onClick={() => router.push(`/dashboard/results/${scan.id}`)}
                    >
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {formatDate(scan.created_at)}
                      </TableCell>
                      <TableCell className="dark:text-gray-300">
                        {scan.files_scanned}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium dark:text-gray-200">
                          {scan.findings_count}
                        </span>
                        {scan.findings_count > 0 && (
                          <span className="text-gray-500 dark:text-gray-500 text-sm ml-1">
                            ({scan.critical_count}C/{scan.high_count}H/
                            {scan.medium_count}M/{scan.low_count}L)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${
                            scan.risk_score >= 80
                              ? "text-red-600 dark:text-red-400"
                              : scan.risk_score >= 50
                              ? "text-orange-600 dark:text-orange-400"
                              : scan.risk_score >= 30
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {scan.risk_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {scan.duration_ms}ms
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(
                          scan.critical_count,
                          scan.high_count,
                          scan.findings_count
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-4">
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
    </div>
  );
}

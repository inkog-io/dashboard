"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { History, FileSearch, AlertTriangle, Clock, AlertCircle } from "lucide-react";

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

import { createAPIClient, type Scan, type ScanSummary, type InkogAPI } from "@/lib/api";

export default function HistoryPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [scans, setScans] = useState<Scan[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch history on mount
  const fetchHistory = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.history.list({ limit: 50, summary: true });
      setScans(response.scans);
      if (response.summary) {
        setSummary(response.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan history");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  // Get severity badge color
  const getSeverityBadge = (critical: number, high: number) => {
    if (critical > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          Critical: {critical}
        </span>
      );
    }
    if (high > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          High: {high}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Clean
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>
        <p className="text-gray-600 mt-1">
          View your recent security scans and findings
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Total Scans</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{summary.total_scans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Files Scanned</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{summary.total_files_scanned}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Total Findings</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{summary.total_findings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Avg Risk Score</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {summary.average_risk_score.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scan History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Scans
          </CardTitle>
          <CardDescription>
            Your most recent security scans from the CLI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No scans yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Run your first scan with the CLI to see results here.
              </p>
              <div className="mt-4">
                <code className="bg-gray-100 px-3 py-2 rounded text-sm">
                  inkog scan -path ./your-agent
                </code>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="text-gray-600">
                      {formatDate(scan.created_at)}
                    </TableCell>
                    <TableCell>{scan.files_scanned}</TableCell>
                    <TableCell>
                      <span className="font-medium">{scan.findings_count}</span>
                      {scan.findings_count > 0 && (
                        <span className="text-gray-500 text-sm ml-1">
                          ({scan.critical_count}C/{scan.high_count}H/
                          {scan.medium_count}M/{scan.low_count}L)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          scan.risk_score >= 8
                            ? "text-red-600"
                            : scan.risk_score >= 5
                            ? "text-orange-600"
                            : scan.risk_score >= 3
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        {scan.risk_score}/10
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {scan.duration_ms}ms
                    </TableCell>
                    <TableCell>
                      {getSeverityBadge(scan.critical_count, scan.high_count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

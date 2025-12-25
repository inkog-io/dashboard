"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  ArrowRight,
  AlertCircle,
  History,
  Clock,
} from "lucide-react";

import {
  createAPIClient,
  type DashboardStats,
  type InkogAPI,
  type Scan,
  type ScanSummary,
} from "@/lib/api";
import { SecurityMetricCard, type MetricVariant } from "@/components/dashboard/SecurityMetricCard";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch stats and history in parallel
      const [statsResponse, historyResponse] = await Promise.all([
        api.stats.get(),
        api.history.list({ limit: 5, summary: true }),
      ]);

      setStats(statsResponse.stats);
      setRecentScans(historyResponse.scans || []);
      setSummary(historyResponse.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate metrics from data
  const getRiskScoreVariant = (score: number): MetricVariant => {
    if (score >= 80) return "danger";
    if (score >= 50) return "warning";
    if (score >= 30) return "info";
    return "success";
  };

  const getGovernanceVariant = (score: number): MetricVariant => {
    if (score >= 80) return "success";
    if (score >= 50) return "warning";
    return "danger";
  };

  const getComplianceBadge = (score: number) => {
    if (score >= 80) return { text: "READY", variant: "success" as const };
    if (score >= 50) return { text: "PARTIAL", variant: "warning" as const };
    return { text: "NOT READY", variant: "danger" as const };
  };

  // Use enhanced stats from backend, with fallbacks
  const riskScore = stats?.risk_score_avg ?? summary?.average_risk_score ?? 0;
  const criticalCount = stats?.critical_unresolved ?? recentScans[0]?.critical_count ?? 0;
  const governanceScore = stats?.governance_score_avg ?? 100;
  const euAiActReadiness = stats?.eu_ai_act_readiness ?? 'NOT_READY';

  const firstName = isLoaded && user?.firstName ? user.firstName : "there";

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {firstName}!</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityMetricCard
          title="Risk Score"
          value={riskScore}
          subtitle="7-day average"
          icon={Shield}
          variant={getRiskScoreVariant(riskScore)}
          loading={loading}
          trend={stats?.findings_trend}
        />
        <SecurityMetricCard
          title="Critical Issues"
          value={criticalCount}
          subtitle="Latest scan"
          icon={AlertTriangle}
          variant={criticalCount > 0 ? "danger" : "success"}
          loading={loading}
        />
        <SecurityMetricCard
          title="Governance Score"
          value={`${governanceScore}%`}
          subtitle="EU AI Act readiness"
          icon={CheckCircle}
          variant={getGovernanceVariant(governanceScore)}
          loading={loading}
        />
        <SecurityMetricCard
          title="Compliance"
          value="EU AI Act"
          subtitle="Article 14 deadline: Aug 2026"
          icon={FileCheck}
          variant="info"
          badge={{
            text: euAiActReadiness === 'READY' ? 'READY' : euAiActReadiness === 'PARTIAL' ? 'PARTIAL' : 'NOT READY',
            variant: euAiActReadiness === 'READY' ? 'success' : euAiActReadiness === 'PARTIAL' ? 'warning' : 'danger'
          }}
          loading={loading}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
          </div>
          <Link
            href="/dashboard/history"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-50 dark:bg-gray-700 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : recentScans.length > 0 ? (
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {recentScans.slice(0, 5).map((scan) => {
              // Determine severity badge
              const severityBadge = scan.critical_count > 0
                ? { text: "Critical", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
                : scan.high_count > 0
                ? { text: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }
                : scan.findings_count > 0
                ? { text: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
                : { text: "Clean", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };

              return (
                <Link
                  key={scan.id}
                  href={`/dashboard/results/${scan.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        scan.critical_count > 0
                          ? "bg-red-500"
                          : scan.high_count > 0
                          ? "bg-orange-500"
                          : scan.findings_count > 0
                          ? "bg-amber-500"
                          : "bg-green-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Scan completed
                        </p>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${severityBadge.className}`}>
                          {severityBadge.text}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scan.findings_count} findings &middot; {scan.files_scanned} files
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Score: {scan.risk_score}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(scan.created_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <Shield className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No scans yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Run your first scan to see security insights
            </p>
            <Link
              href="/dashboard/scan"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Start Scanning
            </Link>
          </div>
        )}

        {/* Quick Action */}
        {recentScans.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
            <Link
              href="/dashboard/scan"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <Shield className="h-4 w-4" />
              Run New Scan
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Summary Stats (if available) */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {summary.total_scans}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
              Total Scans
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {summary.total_files_scanned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
              Files Analyzed
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {summary.total_findings}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
              Issues Found
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {Math.round(summary.average_risk_score)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
              Avg Risk Score
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

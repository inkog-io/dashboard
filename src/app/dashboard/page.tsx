"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Key, ArrowRight, AlertCircle } from "lucide-react";

import { createAPIClient, type DashboardStats, type InkogAPI } from "@/lib/api";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch stats on mount
  const fetchStats = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.stats.get();
      setStats(response.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Format last scan date for display
  const formatLastScan = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const firstName = isLoaded && user?.firstName ? user.firstName : "there";

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {firstName}!
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            API Keys
          </h3>
          {loading ? (
            <div className="mt-2 h-9 w-16 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.api_key_count ?? 0}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-600">Active keys</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Scans Today
          </h3>
          {loading ? (
            <div className="mt-2 h-9 w-16 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.scans_today ?? 0}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-600">
            {stats?.last_scan_at ? `Last: ${formatLastScan(stats.last_scan_at)}` : "No scans yet"}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Total Findings
          </h3>
          {loading ? (
            <div className="mt-2 h-9 w-16 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.total_findings ?? 0}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-600">Security issues found</p>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Start
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Generate an API key</p>
              <p className="text-sm text-gray-600">
                Create your first API key to authenticate CLI requests.
              </p>
              <Link
                href="/dashboard/api-keys"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Key className="h-4 w-4" />
                Manage API Keys
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Install the CLI</p>
              <p className="text-sm text-gray-600">
                Run{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
                  curl -sSL https://inkog.io/install.sh | sh
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Scan your agents</p>
              <p className="text-sm text-gray-600">
                Run{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
                  inkog scan -path ./your-agent -api-key YOUR_KEY
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

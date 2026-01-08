"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  Bot,
  Activity,
  Sparkles,
  X,
  BookOpen,
} from "lucide-react";

import {
  createAPIClient,
  type DashboardStats,
  type InkogAPI,
  type Scan,
  type ScanSummary,
  type Agent,
} from "@/lib/api";
import { SecurityMetricCard, type MetricVariant } from "@/components/dashboard/SecurityMetricCard";
import { AgentList } from "@/components/dashboard/AgentList";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [api, setApi] = useState<InkogAPI | null>(null);
  const [checkingActivation, setCheckingActivation] = useState(true);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch data and check activation status
  const fetchData = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch stats, history, agents, and API keys in parallel
      const [statsResponse, historyResponse, agentsResponse, keysResponse] = await Promise.all([
        api.stats.get(),
        api.history.list({ limit: 5, summary: true }),
        api.agents.list(),
        api.keys.list(),
      ]);

      const scans = historyResponse.scans || [];
      const apiKeys = keysResponse.api_keys || [];

      // User is "activated" if they have ANY scans OR API keys
      const hasActivity = scans.length > 0 || apiKeys.length > 0;

      // Check if coming from onboarding completion
      const fromOnboarding = searchParams.get("completed") === "true";

      if (!hasActivity && !fromOnboarding) {
        // New user with no activity - redirect to onboarding
        router.replace("/dashboard/onboarding");
        return;
      }

      // User is activated - show dashboard
      if (fromOnboarding) {
        setShowWelcomeBanner(true);
      }

      // Track if this is a new user (for showing helpful prompts)
      setIsNewUser(!hasActivity);

      setStats(statsResponse.stats);
      setRecentScans(scans);
      setSummary(historyResponse.summary || null);
      setAgents(agentsResponse.agents || []);
      setCheckingActivation(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setCheckingActivation(false);
    } finally {
      setLoading(false);
    }
  }, [api, router, searchParams]);

  // Handle agent rename
  const handleRenameAgent = async (agent: Agent, newName: string) => {
    if (!api) return;
    try {
      await api.agents.update(agent.id, newName);
      // Refresh agents list
      const response = await api.agents.list();
      setAgents(response.agents || []);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to rename agent:", err);
      }
      // Silently fail - user will see the name didn't change
    }
  };

  // Handle agent delete
  const handleDeleteAgent = async (agent: Agent) => {
    if (!api) return;
    try {
      await api.agents.delete(agent.id);
      // Remove from local state
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to delete agent:", err);
      }
      // Silently fail - agent will remain in list
    }
  };

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

  // Contextual descriptions for metrics
  const getRiskContext = (score: number): string => {
    if (score >= 80) return "Critical - Fix immediately";
    if (score >= 50) return "High risk - Address this week";
    if (score >= 30) return "Moderate - Plan remediation";
    if (score > 0) return "Low risk - Keep monitoring";
    return "No issues detected";
  };

  const getGovernanceContext = (score: number): string => {
    if (score >= 80) return "Compliant with EU AI Act";
    if (score >= 50) return "Partial compliance - Review controls";
    return "Missing required controls";
  };

  // Use enhanced stats from backend, with fallbacks
  const riskScore = stats?.risk_score_avg ?? summary?.average_risk_score ?? 0;
  const criticalCount = stats?.critical_unresolved ?? recentScans[0]?.critical_count ?? 0;
  const governanceScore = stats?.governance_score_avg ?? 100;

  // Agent-centric metrics
  const criticalAgents = agents.filter(a => a.health_status === 'critical').length;
  const warningAgents = agents.filter(a => a.health_status === 'warning').length;
  const healthyAgents = agents.filter(a => a.health_status === 'healthy').length;

  const firstName = isLoaded && user?.firstName ? user.firstName : "there";

  // Don't render until we've checked activation status
  if (checkingActivation) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {firstName}!</p>
        </div>
        <Link
          href="/dashboard/onboarding"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          Setup Guide
        </Link>
      </div>

      {/* Setup Complete Banner */}
      {showWelcomeBanner && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Sparkles className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Setup complete!</h3>
            <p className="text-sm text-green-700 mt-0.5">
              You&apos;re all set. Run your first scan to start monitoring your AI agents for security vulnerabilities.
            </p>
            <Link
              href="/dashboard/scan"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Scan Your First Agent
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <button
            onClick={() => setShowWelcomeBanner(false)}
            className="p-1 text-green-400 hover:text-green-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

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
          title="Agents Monitored"
          value={agents.length}
          subtitle={agents.length === 0 ? "Scan your first agent" : `${healthyAgents} healthy, ${warningAgents} warning, ${criticalAgents} critical`}
          icon={Bot}
          variant={criticalAgents > 0 ? "danger" : warningAgents > 0 ? "warning" : "success"}
          loading={loading}
          tooltip="Total number of AI agents being monitored for security vulnerabilities."
        />
        <SecurityMetricCard
          title="Critical Issues"
          value={criticalCount}
          subtitle={criticalCount > 0 ? "Requires immediate attention" : "No critical issues found"}
          icon={AlertTriangle}
          variant={criticalCount > 0 ? "danger" : "success"}
          loading={loading}
          tooltip="Number of CRITICAL severity findings across all agents. Fix these immediately."
        />
        <SecurityMetricCard
          title="Governance Score"
          value={`${governanceScore}%`}
          subtitle={getGovernanceContext(governanceScore)}
          icon={CheckCircle}
          variant={getGovernanceVariant(governanceScore)}
          loading={loading}
          tooltip="Average governance score across all agents. Based on security controls and compliance requirements."
        />
        <SecurityMetricCard
          title="Avg Risk Score"
          value={riskScore}
          subtitle={getRiskContext(riskScore)}
          icon={Activity}
          variant={getRiskScoreVariant(riskScore)}
          loading={loading}
          trend={stats?.findings_trend}
          tooltip="Average risk score across all agents. Lower is better."
        />
      </div>

      {/* Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your Agents</h2>
          </div>
          <Link
            href="/dashboard/scan"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1"
          >
            <Shield className="h-4 w-4" />
            Scan New Agent
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <AgentList
          agents={agents}
          loading={loading}
          onRename={handleRenameAgent}
          onDelete={handleDeleteAgent}
        />
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

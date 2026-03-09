"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { cn, compactTimeAgo } from "@/lib/utils";
import { SecurityMetricCard, type MetricVariant } from "@/components/dashboard/SecurityMetricCard";
import { AgentList } from "@/components/dashboard/AgentList";
import { SkeletonCrossfade, SkeletonMetricCard } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [dismissedEmptyBanner, setDismissedEmptyBanner] = useState(false);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Check if coming from completed onboarding
  useEffect(() => {
    if (searchParams.get("completed") === "true") {
      setShowWelcomeBanner(true);
    }
  }, [searchParams]);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch stats, history, and agents in parallel
      const [statsResponse, historyResponse, agentsResponse] = await Promise.all([
        api.stats.get(),
        api.history.list({ limit: 50, summary: true }),
        api.agents.list(),
      ]);

      setStats(statsResponse.stats);
      setRecentScans(historyResponse.scans || []);
      setSummary(historyResponse.summary || null);
      setAgents(agentsResponse.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [api]);

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
    if (score === 0 && agents.length === 0) return "Run your first scan";
    if (score >= 80) return "Compliant with EU AI Act";
    if (score >= 50) return "Partial compliance - Review controls";
    return "Missing required controls";
  };

  // Use enhanced stats from backend, with fallbacks
  const showEmptyStateBanner = agents.length === 0 && !loading && !error && !dismissedEmptyBanner;
  const riskScore = stats?.risk_score_avg ?? summary?.average_risk_score ?? 0;
  const criticalCount = stats?.critical_unresolved ?? recentScans[0]?.critical_count ?? 0;
  const governanceScore = stats?.governance_score_avg ?? 0;

  // Build scan policy lookup from recent scans
  const scanPolicies: Record<string, string> = {};
  for (const scan of recentScans) {
    scanPolicies[scan.id] = scan.scan_policy || "balanced";
  }

  // Agent-centric metrics
  const criticalAgents = agents.filter(a => a.health_status === 'critical').length;
  const warningAgents = agents.filter(a => a.health_status === 'warning').length;
  const healthyAgents = agents.filter(a => a.health_status === 'healthy').length;

  // Skill scan metrics
  const skillScans = recentScans.filter(s => s.scan_type === 'skill');
  const uniqueSkillNames = new Set(skillScans.map(s => s.agent_name || s.id));
  const skillCriticalCount = skillScans.reduce((sum, s) => sum + (s.critical_count || 0), 0);

  // Use first name if available and meaningful, otherwise fall back to email prefix
  const firstName = (() => {
    if (!isLoaded) return "there";
    if (user?.firstName && user.firstName.length > 1) return user.firstName;
    // Fall back to email prefix (part before @)
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email) {
      const prefix = email.split("@")[0];
      // Capitalize first letter
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "there";
  })();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-start justify-between animate-stagger-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {firstName}!</p>
        </div>
        <Link
          href="/dashboard/onboarding"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          Setup Guide
        </Link>
      </div>

      {/* Welcome / Empty State Banner */}
      {(showWelcomeBanner || showEmptyStateBanner) && (
        <div className="bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Sparkles className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              {showWelcomeBanner ? "Setup complete!" : "Get started"}
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
              {showWelcomeBanner
                ? "You're all set. Run your first scan to start monitoring your AI agents for security vulnerabilities."
                : "Scan your AI agents or MCP servers to discover security vulnerabilities and compliance gaps."}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Link
                href="/dashboard/scan"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <Bot className="h-4 w-4" />
                Scan Agent
              </Link>
              <Link
                href="/dashboard/scan?mode=skill"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-green-600 text-green-700 dark:text-green-300 text-sm font-medium rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <Shield className="h-4 w-4" />
                Scan MCP Server
              </Link>
            </div>
          </div>
          <button
            onClick={() => {
              setShowWelcomeBanner(false);
              setDismissedEmptyBanner(true);
            }}
            className="p-1 text-green-400 dark:text-green-600 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Security Metrics Grid */}
      <SkeletonCrossfade
        loading={loading}
        skeleton={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
        }
        className="animate-stagger-2"
      >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityMetricCard
          title="Assets Monitored"
          value={agents.length + uniqueSkillNames.size}
          subtitle={
            agents.length === 0 && uniqueSkillNames.size === 0
              ? "Run your first scan"
              : `${agents.length} agents, ${uniqueSkillNames.size} skills`
          }
          icon={Bot}
          variant={criticalAgents > 0 ? "danger" : warningAgents > 0 ? "warning" : "success"}
          loading={loading}
          tooltip="Total number of AI agents being monitored for security vulnerabilities."
          docsUrl="https://docs.inkog.io/getting-started/dashboard"
        />
        <SecurityMetricCard
          title="Critical Issues"
          value={criticalCount}
          subtitle={criticalCount > 0 ? "Requires immediate attention" : "No critical issues found"}
          icon={AlertTriangle}
          variant={criticalCount > 0 ? "danger" : "success"}
          loading={loading}
          tooltip="Number of CRITICAL severity findings across all agents. Fix these immediately."
          docsUrl="https://docs.inkog.io/vulnerabilities"
        />
        <SecurityMetricCard
          title="Governance Score"
          value={`${governanceScore}%`}
          subtitle={getGovernanceContext(governanceScore)}
          icon={CheckCircle}
          variant={getGovernanceVariant(governanceScore)}
          loading={loading}
          tooltip="Average governance score across all agents. Based on security controls and compliance requirements."
          docsUrl="https://docs.inkog.io/governance"
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
          docsUrl="https://docs.inkog.io/core-concepts/scoring"
        />
      </div>
      </SkeletonCrossfade>

      {/* Agents Section */}
      <div className="animate-stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Your Agents</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/scan" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Bot className="h-4 w-4" />
              Scan Agent
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <span className="text-border">|</span>
            <Link href="/dashboard/scan?mode=skill" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Scan MCP
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <AgentList
          agents={agents}
          loading={loading}
          scanPolicies={scanPolicies}
          onRename={handleRenameAgent}
          onDelete={handleDeleteAgent}
        />
      </div>

      {/* Recent Skill Scans */}
      {skillScans.length > 0 && (
        <div className="animate-stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Recent Skill Scans</h2>
            </div>
            <Link href="/dashboard/history" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {skillScans.slice(0, 5).map((scan) => (
                  <tr key={scan.id} onClick={() => router.push(`/dashboard/skills/${scan.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{scan.agent_name || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        scan.risk_score >= 80 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                        scan.risk_score >= 50 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
                        scan.risk_score >= 30 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                        "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      )}>
                        {scan.risk_score >= 80 ? 'Critical' : scan.risk_score >= 50 ? 'High' : scan.risk_score >= 30 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{compactTimeAgo(new Date(scan.created_at))}</td>
                    <td className="px-4 py-3">
                      {scan.ai_scan_status === 'completed'
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-semibold">Deep</span>
                        : <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">Core</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats (if available) */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/20 transition-colors">
            <p className="text-3xl tracking-tight font-semibold text-foreground font-display">
              {summary.total_scans}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Total Scans
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/20 transition-colors">
            <p className="text-3xl tracking-tight font-semibold text-foreground font-display">
              {summary.total_files_scanned.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Files Analyzed
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/20 transition-colors">
            <p className="text-3xl tracking-tight font-semibold text-foreground font-display">
              {summary.total_findings}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Issues Found
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/20 transition-colors">
            <p className="text-3xl tracking-tight font-semibold text-foreground font-display">
              {Math.round(summary.average_risk_score)}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Avg Risk Score
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

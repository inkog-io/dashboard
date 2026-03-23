"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ─── Types ─────────────────────────────────────────────────────────────────

interface RedScanResponse {
  scan_id: string;
  status: "processing" | "completed" | "failed";
  scan: RedScan;
}

interface RedScan {
  id: string;
  target_url: string;
  target_name?: string;
  scan_tier: string;
  created_at: string;
  resilience_score: number;
  resilience_grade: string;
  extraction_resilience: number;
  injection_resilience: number;
  evasion_resilience: number;
  consistency_score: number;
  compliance_resilience?: number;
  probes_total: number;
  probes_executed: number;
  defended_count: number;
  exposed_count: number;
  degraded_count: number;
  error_count: number;
  duration_ms: number;
  // OWASP mapping comes as dict from agent, stored as JSONB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  owasp_mapping?: any;
  probe_results?: ProbeResult[];
}

interface OwaspEntry {
  id: string;
  name: string;
  total: number;
  defended: number;
  exposed: number;
  degraded: number;
  resilience: number; // 0-100 (normalized from agent's 0-1)
}

interface ProbeResult {
  probe_id: string;
  category: string;
  subcategory?: string;
  response?: string;
  verdict: "defended" | "exposed" | "degraded" | "error";
  confidence?: number;
  latency_ms?: number;
  detection_details?: string;
  severity: string;
  owasp_id?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function gradeColor(grade: string) {
  switch (grade?.toLowerCase()) {
    case "hardened":
    case "resilient":
    case "a":
      return "text-green-600 dark:text-green-400";
    case "moderate":
    case "b":
      return "text-amber-600 dark:text-amber-400";
    case "vulnerable":
    case "weak":
    case "c":
    case "d":
    case "f":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-foreground";
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function verdictBadge(verdict: string) {
  switch (verdict) {
    case "defended":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    case "exposed":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    case "degraded":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
}

function severityBadge(severity: string) {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    case "HIGH":
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
    case "MEDIUM":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    default:
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
  }
}

function categoryLabel(category: string, subcategory?: string) {
  const sub = subcategory ? `/${subcategory}` : "";
  return `${category}${sub}`.replace(/_/g, " ");
}

function formatDuration(ms: number) {
  if (!ms) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/** Normalize OWASP mapping from agent dict format to sorted array with 0-100 resilience. */
function normalizeOwaspMapping(raw: unknown): OwaspEntry[] {
  if (!raw || typeof raw !== "object") return [];

  // Already an array (future-proof)
  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      ...e,
      resilience: e.resilience <= 1 ? e.resilience * 100 : e.resilience,
    }));
  }

  // Dict format from agent: { "LLM01": { id, name, total, defended, exposed, degraded, resilience } }
  return Object.values(raw as Record<string, OwaspEntry>)
    .map((entry) => ({
      ...entry,
      resilience: entry.resilience <= 1 ? entry.resilience * 100 : entry.resilience,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function RedScanResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [scan, setScan] = useState<RedScan | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);
  const [showAllProbes, setShowAllProbes] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const poll = async () => {
      const api = createAPIClient(getToken);
      try {
        // Use generic request since red scan API isn't in the typed client yet
        const token = await getToken();
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "https://api.inkog.io"}/v1/red/scan/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: RedScanResponse = await res.json();

        if (cancelled) return;
        setScan(data.scan);
        setStatus(data.status);

        if (data.status === "processing") {
          setTimeout(poll, 5000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scan");
          setStatus("error");
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [id, getToken]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.inkog.io"}/v1/red/scan/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      router.push("/dashboard/history");
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleCopyJSON = () => {
    if (!scan) return;
    navigator.clipboard.writeText(JSON.stringify(scan, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Normalize OWASP mapping (dict → sorted array, 0-1 → 0-100)
  const owaspEntries = useMemo(
    () => (scan ? normalizeOwaspMapping(scan.owasp_mapping) : []),
    [scan]
  );

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error" || !scan) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/history")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to History
        </Button>
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error || "Scan not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Processing ───────────────────────────────────────────────────────────
  if (status === "processing") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/history")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to History
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Red Scan in Progress</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Testing adversarial resilience of {scan.target_url}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Tier: {scan.scan_tier}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Failed ───────────────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/history")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to History
        </Button>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <ShieldAlert className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Red Scan Failed</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Target: {scan.target_url}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Completed ────────────────────────────────────────────────────────────
  const exposures = (scan.probe_results ?? []).filter((p) => p.verdict === "exposed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/history")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Inkog Red Scan
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 uppercase">
                {scan.scan_tier}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {scan.target_name || scan.target_url}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyJSON}>
            <Copy className="h-4 w-4 mr-1.5" />
            {copied ? "Copied!" : "Export JSON"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resilience Score Hero */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="h-28 w-28" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke={scan.resilience_score >= 80 ? "#22c55e" : scan.resilience_score >= 60 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(scan.resilience_score / 100) * 327} 327`}
                    transform="rotate(-90 60 60)"
                  />
                  <text x="60" y="55" textAnchor="middle" className="text-3xl font-bold" fill="white" fontSize="28">
                    {scan.resilience_score}
                  </text>
                  <text x="60" y="75" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="12">
                    / 100
                  </text>
                </svg>
              </div>
              <div>
                <p className="text-sm text-white/60 uppercase tracking-wider">Resilience Score</p>
                <p className={`text-3xl font-bold mt-1 ${scan.resilience_score >= 80 ? "text-green-400" : scan.resilience_score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {scan.resilience_grade || "N/A"}
                </p>
                <p className="text-sm text-white/40 mt-1">
                  {scan.probes_total} probes • {formatDuration(scan.duration_ms)}
                </p>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-2 gap-x-12 gap-y-3 text-right">
              <div>
                <p className="text-xs text-white/50">Extraction</p>
                <p className={`text-lg font-semibold ${scoreColor(scan.extraction_resilience)}`}>
                  {scan.extraction_resilience.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50">Injection</p>
                <p className={`text-lg font-semibold ${scoreColor(scan.injection_resilience)}`}>
                  {scan.injection_resilience.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50">Evasion</p>
                <p className={`text-lg font-semibold ${scoreColor(scan.evasion_resilience)}`}>
                  {scan.evasion_resilience.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50">Consistency</p>
                <p className={`text-lg font-semibold ${scoreColor(scan.consistency_score)}`}>
                  {scan.consistency_score.toFixed(0)}%
                </p>
              </div>
              {scan.compliance_resilience != null && scan.compliance_resilience > 0 && (
                <div>
                  <p className="text-xs text-white/50">Compliance</p>
                  <p className={`text-lg font-semibold ${scoreColor(scan.compliance_resilience)}`}>
                    {scan.compliance_resilience.toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Probe Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: scan.probes_total, color: "text-foreground" },
          { label: "Defended", value: scan.defended_count, color: "text-green-600 dark:text-green-400" },
          { label: "Degraded", value: scan.degraded_count, color: "text-amber-600 dark:text-amber-400" },
          { label: "Exposed", value: scan.exposed_count, color: "text-red-600 dark:text-red-400" },
          { label: "Error", value: scan.error_count, color: "text-gray-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score Breakdown Bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Resilience Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Extraction Resilience", value: scan.extraction_resilience },
            { label: "Injection Resilience", value: scan.injection_resilience },
            { label: "Evasion Resilience", value: scan.evasion_resilience },
            { label: "Consistency", value: scan.consistency_score },
            ...(scan.compliance_resilience != null && scan.compliance_resilience > 0
              ? [{ label: "Compliance Resilience", value: scan.compliance_resilience }]
              : []),
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-semibold ${scoreColor(item.value)}`}>
                  {item.value.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreBg(item.value)}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* OWASP LLM Top 10 */}
      {owaspEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              OWASP LLM Top 10 Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {owaspEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {entry.id}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">
                          {entry.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {entry.defended}/{entry.total}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ml-2 shrink-0 ${scoreColor(entry.resilience)}`}>
                        {entry.resilience.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreBg(entry.resilience)}`}
                        style={{ width: `${entry.resilience}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exposures */}
      {exposures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Exposures ({exposures.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(showAllProbes ? exposures : exposures.slice(0, 10)).map((probe, i) => (
                <div
                  key={`${probe.probe_id}-${i}`}
                  className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${severityBadge(probe.severity)}`}>
                      {probe.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{probe.probe_id}</p>
                        <span className="text-xs text-muted-foreground">
                          {categoryLabel(probe.category, probe.subcategory)}
                        </span>
                        {probe.owasp_id && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {probe.owasp_id}
                          </span>
                        )}
                      </div>
                      {probe.detection_details && (
                        <p className="text-xs text-muted-foreground mt-1">{probe.detection_details}</p>
                      )}
                      {probe.response && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 italic">
                          &ldquo;{probe.response.slice(0, 200)}{probe.response.length > 200 ? "..." : ""}&rdquo;
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${verdictBadge(probe.verdict)}`}>
                      {probe.verdict}
                    </span>
                  </div>
                </div>
              ))}
              {exposures.length > 10 && !showAllProbes && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAllProbes(true)}
                >
                  Show all {exposures.length} exposures
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Probes */}
      {scan.probe_results && scan.probe_results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Probe Results ({scan.probe_results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {scan.probe_results.map((probe, i) => (
                <div
                  key={`${probe.probe_id}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 transition-colors text-sm"
                >
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-20 justify-center shrink-0 ${verdictBadge(probe.verdict)}`}>
                    {probe.verdict}
                  </span>
                  <span className="text-muted-foreground w-28 truncate shrink-0">{probe.probe_id}</span>
                  <span className="text-muted-foreground/60 w-32 truncate shrink-0 text-xs">
                    {categoryLabel(probe.category, probe.subcategory)}
                  </span>
                  <span className="text-foreground flex-1 truncate">
                    {probe.detection_details || "—"}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${severityBadge(probe.severity)}`}>
                    {probe.severity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Scan ID: {id}</span>
            <span>Created: {new Date(scan.created_at).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Red scan"
        description="This will permanently delete this Red scan and its results. This action cannot be undone."
        confirmLabel="Delete scan"
        loading={deleting}
      />
    </div>
  );
}

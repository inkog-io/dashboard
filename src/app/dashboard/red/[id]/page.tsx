"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { compactTimeAgo } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X,
  Clock,
  Target,
  Fingerprint,
  Zap,
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

const severityOrd: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

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

const severityColors: Record<string, { bg: string; text: string; border: string; left: string }> = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    left: "border-l-red-500",
  },
  HIGH: {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    left: "border-l-orange-500",
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    left: "border-l-amber-500",
  },
  LOW: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    left: "border-l-blue-500",
  },
};

const verdictColors: Record<string, { bg: string; text: string; border: string }> = {
  exposed: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  defended: {
    bg: "bg-green-50 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
  degraded: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  error: {
    bg: "bg-gray-50 dark:bg-gray-900/30",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
};

const filterBtnColors: Record<string, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
    inactive: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
  },
  exposed: {
    active: "bg-red-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-red-600 border border-red-300 dark:border-red-800",
  },
  defended: {
    active: "bg-green-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-green-600 border border-green-300 dark:border-green-800",
  },
  degraded: {
    active: "bg-amber-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-amber-600 border border-amber-300 dark:border-amber-800",
  },
  error: {
    active: "bg-gray-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-gray-600 border border-gray-300 dark:border-gray-700",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function RedScanResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [scan, setScan] = useState<RedScan | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);
  const [showAllExposures, setShowAllExposures] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedProbe, setSelectedProbe] = useState<ProbeResult | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const poll = async () => {
      try {
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
  const exposures = (scan.probe_results ?? [])
    .filter((p) => p.verdict === "exposed")
    .sort((a, b) => (severityOrd[a.severity?.toUpperCase()] ?? 4) - (severityOrd[b.severity?.toUpperCase()] ?? 4));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/history")}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                {scan.target_name || "Red Scan"}
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 uppercase">
                {scan.scan_tier}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 truncate max-w-xs" title={scan.target_url}>
                <Target className="h-3.5 w-3.5 shrink-0" />
                {scan.target_url}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(scan.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {compactTimeAgo(new Date(scan.created_at))}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9" onClick={handleCopyJSON}>
            <Copy className="h-4 w-4 mr-2" />
            {copied ? "Copied!" : "Export JSON"}
          </Button>
          <Button
            variant="outline"
            className="h-9 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 border-red-200 dark:border-red-800"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Resilience Score + Summary Stats */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          {/* Score circle + grade */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="relative">
              <svg className="h-24 w-24" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke={scan.resilience_score >= 80 ? "#22c55e" : scan.resilience_score >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(scan.resilience_score / 100) * 327} 327`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="56" textAnchor="middle" className="text-2xl font-bold" fill="currentColor" fontSize="26">
                  {scan.resilience_score}
                </text>
                <text x="60" y="74" textAnchor="middle" className="text-muted-foreground" fill="currentColor" fontSize="11" opacity="0.5">
                  / 100
                </text>
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resilience Score</p>
              <p className={`text-2xl font-bold mt-0.5 ${scoreColor(scan.resilience_score)}`}>
                {scan.resilience_grade || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {scan.probes_total} probes &middot; {formatDuration(scan.duration_ms)}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-20 bg-border" />

          {/* Probe breakdown stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {scan.defended_count}
              </p>
              <p className="text-xs text-muted-foreground uppercase">Defended</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {scan.degraded_count}
              </p>
              <p className="text-xs text-muted-foreground uppercase">Degraded</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {scan.exposed_count}
              </p>
              <p className="text-xs text-muted-foreground uppercase">Exposed</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {scan.error_count}
              </p>
              <p className="text-xs text-muted-foreground uppercase">Error</p>
            </div>
          </div>
        </div>

        {/* Scan metadata line */}
        <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground text-center">
          {scan.probes_total} probes executed in {formatDuration(scan.duration_ms)}
          <span className="ml-2">&middot; Tier: <span className="capitalize">{scan.scan_tier}</span></span>
        </div>
      </div>

      {/* Resilience Breakdown */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Resilience Breakdown
          </h2>
        </div>
        <div className="p-6 space-y-5">
          {[
            { label: "Extraction", desc: "System prompt leakage resistance", value: scan.extraction_resilience, icon: ShieldOff },
            { label: "Injection", desc: "Prompt injection resistance", value: scan.injection_resilience, icon: Zap },
            { label: "Evasion", desc: "Encoding & obfuscation resistance", value: scan.evasion_resilience, icon: Fingerprint },
            { label: "Consistency", desc: "Response stability across mutations", value: scan.consistency_score, icon: Target },
            ...(scan.compliance_resilience != null && scan.compliance_resilience > 0
              ? [{ label: "Compliance", desc: "Safety & content policy adherence", value: scan.compliance_resilience, icon: Shield }]
              : []),
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <div className={`p-2 rounded-lg shrink-0 ${
                item.value >= 80 ? "bg-green-50 dark:bg-green-900/20" :
                item.value >= 60 ? "bg-amber-50 dark:bg-amber-900/20" :
                "bg-red-50 dark:bg-red-900/20"
              }`}>
                <item.icon className={`h-4 w-4 ${
                  item.value >= 80 ? "text-green-600 dark:text-green-400" :
                  item.value >= 60 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{item.desc}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${scoreColor(item.value)}`}>
                    {item.value.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${scoreBg(item.value)}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OWASP LLM Top 10 */}
      {owaspEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              OWASP LLM Top 10 Mapping
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {owaspEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4">
                <span className={`text-xs font-mono px-2 py-1 rounded-md shrink-0 font-semibold ${
                  entry.resilience >= 80
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : entry.resilience >= 60
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                }`}>
                  {entry.id}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {entry.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {entry.defended}/{entry.total} defended
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ml-2 shrink-0 tabular-nums ${scoreColor(entry.resilience)}`}>
                      {entry.resilience.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scoreBg(entry.resilience)}`}
                      style={{ width: `${entry.resilience}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exposures */}
      {exposures.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Exposures
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                {exposures.length}
              </span>
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {(showAllExposures ? exposures : exposures.slice(0, 10)).map((probe, i) => {
              const colors = severityColors[probe.severity?.toUpperCase()] || severityColors.LOW;
              return (
                <button
                  key={`${probe.probe_id}-${i}`}
                  onClick={() => setSelectedProbe(probe)}
                  className={`w-full text-left p-3 rounded-lg border-l-2 border ${colors.border} ${colors.left} hover:bg-muted/30 transition-colors group`}
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })}
            {exposures.length > 10 && !showAllExposures && (
              <button
                className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                onClick={() => setShowAllExposures(true)}
              >
                Show all {exposures.length} exposures
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* All Probes */}
      {scan.probe_results && scan.probe_results.length > 0 && (() => {
        const verdictCounts: Record<string, number> = { exposed: 0, defended: 0, degraded: 0, error: 0 };
        for (const p of scan.probe_results) {
          if (p.verdict in verdictCounts) verdictCounts[p.verdict]++;
        }
        const filteredProbes = verdictFilter === "ALL"
          ? scan.probe_results
          : scan.probe_results.filter((p) => p.verdict === verdictFilter);

        return (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold">All Probe Results ({scan.probe_results.length})</h2>
            </div>

            {/* Verdict Filter Pills */}
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setVerdictFilter("ALL")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    verdictFilter === "ALL" ? filterBtnColors.ALL.active : filterBtnColors.ALL.inactive
                  }`}
                >
                  All ({scan.probe_results.length})
                </button>
                {(["exposed", "defended", "degraded", "error"] as const).map(
                  (v) =>
                    verdictCounts[v] > 0 && (
                      <button
                        key={v}
                        onClick={() => setVerdictFilter(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          verdictFilter === v ? filterBtnColors[v].active : filterBtnColors[v].inactive
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)} ({verdictCounts[v]})
                      </button>
                    )
                )}
              </div>
            </div>

            <div className="divide-y divide-border">
              {filteredProbes.map((probe, i) => (
                <button
                  key={`${probe.probe_id}-${i}`}
                  onClick={() => setSelectedProbe(probe)}
                  className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-sm group cursor-pointer"
                >
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-20 justify-center shrink-0 ${verdictBadge(probe.verdict)}`}>
                    {probe.verdict}
                  </span>
                  <span className="text-muted-foreground w-28 truncate shrink-0 font-mono text-xs">{probe.probe_id}</span>
                  <span className="text-muted-foreground/60 w-32 truncate shrink-0 text-xs">
                    {categoryLabel(probe.category, probe.subcategory)}
                  </span>
                  <span className="text-foreground flex-1 truncate text-xs">
                    {probe.detection_details || "\u2014"}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${severityBadge(probe.severity)}`}>
                    {probe.severity}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
              {filteredProbes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No probes match the selected filter.
                </div>
              )}
            </div>

            {/* Results count footer */}
            {filteredProbes.length > 0 && verdictFilter !== "ALL" && (
              <div className="px-5 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground">
                Showing {filteredProbes.length} of {scan.probe_results.length} probes
              </div>
            )}
          </div>
        );
      })()}

      {/* Probe Details Panel */}
      <ProbeDetailsPanel
        probe={selectedProbe}
        open={!!selectedProbe}
        onClose={() => setSelectedProbe(null)}
      />

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

// ─── Probe Details Panel ──────────────────────────────────────────────────

function ProbeDetailsPanel({
  probe,
  open,
  onClose,
}: {
  probe: ProbeResult | null;
  open: boolean;
  onClose: () => void;
}) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  const vc = probe ? verdictColors[probe.verdict] || verdictColors.error : verdictColors.error;
  const sc = probe ? severityColors[probe.severity?.toUpperCase()] || severityColors.LOW : severityColors.LOW;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && probe && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-[60] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${vc.border} ${vc.bg}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${verdictBadge(probe.verdict)}`}>
                  {probe.verdict}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${severityBadge(probe.severity)}`}>
                  {probe.severity}
                </span>
                {probe.owasp_id && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {probe.owasp_id}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Probe ID & Category */}
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-muted-foreground" />
                  {probe.probe_id}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {categoryLabel(probe.category, probe.subcategory)}
                </p>
              </div>

              {/* Detection Details */}
              {probe.detection_details && (
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Target className="h-4 w-4" />
                    Detection
                  </h3>
                  <div className={`rounded-lg border p-3 ${sc.border} ${sc.bg}`}>
                    <p className={`text-sm ${sc.text}`}>{probe.detection_details}</p>
                  </div>
                </div>
              )}

              {/* Classification */}
              <div>
                <h3 className="text-sm font-medium mb-2">Classification</h3>
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Verdict</span>
                    <span className={`font-medium ${vc.text}`}>
                      {probe.verdict.charAt(0).toUpperCase() + probe.verdict.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Severity</span>
                    <span className={`font-medium ${sc.text}`}>{probe.severity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{probe.category?.replace(/_/g, " ")}</span>
                  </div>
                  {probe.subcategory && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subcategory</span>
                      <span className="font-medium">{probe.subcategory.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {probe.confidence != null && probe.confidence > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="font-medium">
                        {probe.confidence <= 1
                          ? `${Math.round(probe.confidence * 100)}%`
                          : `${Math.round(probe.confidence)}%`}
                      </span>
                    </div>
                  )}
                  {probe.owasp_id && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">OWASP LLM</span>
                      <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded">{probe.owasp_id}</span>
                    </div>
                  )}
                  {probe.latency_ms != null && probe.latency_ms > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Latency
                      </span>
                      <span className="font-medium">{probe.latency_ms}ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Response */}
              {probe.response && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Model Response</h3>
                  <div className="rounded-lg border border-border bg-gray-50 dark:bg-gray-900/50 p-4 max-h-80 overflow-y-auto">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {probe.response}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{probe.probe_id}</span>
              <span>{categoryLabel(probe.category, probe.subcategory)}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

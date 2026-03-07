"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  X,
  MapPin,
  FileCode,
  Zap,
  Lock,
  Globe,
  Database,
  Terminal,
  Key,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  createAPIClient,
  type SkillScanResult,
  type SkillFinding,
  type SkillToolAnalysis,
  type SkillPermissions,
} from "@/lib/api";

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

const filterColors: Record<string, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
    inactive: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
  },
  CRITICAL: {
    active: "bg-red-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-red-600 border border-red-300 dark:border-red-800",
  },
  HIGH: {
    active: "bg-orange-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-orange-600 border border-orange-300 dark:border-orange-800",
  },
  MEDIUM: {
    active: "bg-amber-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-amber-600 border border-amber-300 dark:border-amber-800",
  },
  LOW: {
    active: "bg-blue-600 text-white",
    inactive: "bg-white dark:bg-gray-800 text-blue-600 border border-blue-300 dark:border-blue-800",
  },
};

const riskColor: Record<string, string> = {
  critical: "text-red-600",
  high: "text-yellow-600",
  medium: "text-orange-600",
  low: "text-green-600",
};

const toolRiskBadge: Record<string, string> = {
  dangerous: "bg-red-100 text-red-700",
  moderate: "bg-yellow-100 text-yellow-700",
  safe: "bg-green-100 text-green-700",
};

const severityOrd: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function formatCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function SkillScanResultPage() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [result, setResult] = useState<SkillScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFinding, setSelectedFinding] = useState<SkillFinding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  useEffect(() => {
    const cached = sessionStorage.getItem(`skill-scan-${id}`);
    if (cached) {
      try {
        setResult(JSON.parse(cached));
      } catch {
        // ignore parse errors
      }
    }
    setLoading(false);
  }, [id]);

  const sortedFindings = result
    ? [...result.findings].sort(
        (a, b) => (severityOrd[a.severity] ?? 4) - (severityOrd[b.severity] ?? 4)
      )
    : [];
  const filteredFindings =
    severityFilter === "ALL"
      ? sortedFindings
      : sortedFindings.filter((f) => f.severity === severityFilter);

  if (loading) {
    return <div className="flex justify-center py-12">Loading...</div>;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Scan result not found. Results are currently only available immediately after scanning.
        </p>
      </div>
    );
  }

  const severityCounts: Record<string, number> = {
    CRITICAL: result.critical_count,
    HIGH: result.high_count,
    MEDIUM: result.medium_count,
    LOW: result.low_count,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {result.name || "Skill Scan"}
          </h1>
          <p className="text-muted-foreground">{result.source}</p>
        </div>
        <div className={`text-3xl font-bold ${riskColor[result.overall_risk]}`}>
          {result.security_score}/100
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${riskColor[result.overall_risk]}`}>
              {result.overall_risk.toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Overall Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{result.findings.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Findings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{result.files_scanned}</div>
            <div className="text-xs text-muted-foreground mt-1">Files Scanned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{Math.round(result.analyzability * 100)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Analyzability</div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions */}
      {result.permissions && <PermissionCard permissions={result.permissions} />}

      {/* Tool Analysis */}
      {result.tool_analyses?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Tool Analysis ({result.tool_analyses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.tool_analyses.map((tool, i) => (
                <ToolCard key={i} tool={tool} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Findings ({result.findings.length})
          </CardTitle>
          <CardDescription>
            <span className="text-red-600">{result.critical_count} Critical</span>
            {" | "}
            <span className="text-orange-600">{result.high_count} High</span>
            {" | "}
            <span className="text-amber-600">{result.medium_count} Medium</span>
            {" | "}
            <span className="text-blue-600">{result.low_count} Low</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Severity Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSeverityFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                severityFilter === "ALL"
                  ? filterColors.ALL.active
                  : filterColors.ALL.inactive
              }`}
            >
              All ({result.findings.length})
            </button>
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(
              (sev) =>
                severityCounts[sev] > 0 && (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      severityFilter === sev
                        ? filterColors[sev].active
                        : filterColors[sev].inactive
                    }`}
                  >
                    {sev.charAt(0) + sev.slice(1).toLowerCase()} ({severityCounts[sev]})
                  </button>
                )
            )}
          </div>

          <div className="space-y-2">
            {filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onClick={() => setSelectedFinding(finding)}
              />
            ))}
            {result.findings.length === 0 && (
              <div className="flex items-center gap-2 text-green-600 py-4 justify-center">
                <CheckCircle className="h-5 w-5" />
                <span>No security findings detected</span>
              </div>
            )}
            {result.findings.length > 0 && filteredFindings.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No findings match the selected filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Finding Details Panel */}
      <SkillFindingDetailsPanel
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}

function PermissionCard({ permissions }: { permissions: SkillPermissions }) {
  const permItems = [
    { key: "file_access", label: "File Access", icon: FileCode, enabled: permissions.file_access },
    { key: "network_access", label: "Network Access", icon: Globe, enabled: permissions.network_access },
    { key: "code_execution", label: "Code Execution", icon: Terminal, enabled: permissions.code_execution },
    { key: "database_access", label: "Database Access", icon: Database, enabled: permissions.database_access },
    { key: "environment_access", label: "Environment Access", icon: Key, enabled: permissions.environment_access },
  ];

  const isLethalTrifecta = permissions.code_execution && permissions.network_access &&
    (permissions.file_access || permissions.environment_access);

  return (
    <Card className={isLethalTrifecta ? "border-red-300" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Permission Analysis
          <span className="text-sm font-normal text-muted-foreground">
            (Scope: {permissions.scope})
          </span>
        </CardTitle>
        {isLethalTrifecta && (
          <CardDescription className="text-red-600 font-medium">
            Warning: Lethal Trifecta detected (Code Execution + Network + File/Env Access)
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {permItems.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.key}
                className={`flex flex-col items-center p-3 rounded-lg border ${
                  p.enabled
                    ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs text-center">{p.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ToolCard({ tool }: { tool: SkillToolAnalysis }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div>
        <span className="font-medium">{tool.name}</span>
        {tool.description && (
          <span className="text-sm text-muted-foreground ml-2">
            {tool.description.length > 80 ? tool.description.slice(0, 80) + "..." : tool.description}
          </span>
        )}
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${toolRiskBadge[tool.risk_level] || ""}`}>
        {tool.risk_level}
      </span>
    </div>
  );
}

function FindingCard({
  finding,
  onClick,
}: {
  finding: SkillFinding;
  onClick: () => void;
}) {
  const colors = severityColors[finding.severity] || severityColors.LOW;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-l-2 border ${colors.border} ${colors.left} bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: Severity badge + title + category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {finding.severity}
            </span>
            <span className="font-medium text-sm truncate">{finding.title}</span>
            {finding.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatCategory(finding.category)}
              </span>
            )}
          </div>

          {/* Row 2: File:line + confidence */}
          <div className="flex items-center gap-3 mt-1.5">
            {finding.file && (
              <code className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {finding.file}
                {finding.line ? `:${finding.line}` : ""}
              </code>
            )}
            {finding.confidence > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(finding.confidence * 100)}% confidence
              </span>
            )}
          </div>

          {/* Row 3: Tags */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {finding.owasp_agentic && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                OWASP Agentic: {finding.owasp_agentic}
              </span>
            )}
            {finding.owasp_mcp && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                OWASP MCP: {finding.owasp_mcp}
              </span>
            )}
            {finding.detection_layer && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
                {finding.detection_layer}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

function SkillFindingDetailsPanel({
  finding,
  open,
  onClose,
}: {
  finding: SkillFinding | null;
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

  const colors = finding ? severityColors[finding.severity] || severityColors.LOW : severityColors.LOW;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && finding && (
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
            <div className={`flex items-center justify-between p-4 border-b ${colors.border} ${colors.bg}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {finding.severity}
                </span>
                {finding.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                    {formatCategory(finding.category)}
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
              {/* Title & Description */}
              <div>
                <h2 className="text-lg font-semibold">{finding.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
              </div>

              {/* Location */}
              {finding.file && (
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h3>
                  <code className="block text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                    {finding.file}
                    {finding.line ? `:${finding.line}` : ""}
                  </code>
                </div>
              )}

              {/* Code Snippet */}
              {finding.code_snippet && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Code</h3>
                  <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-lg overflow-x-auto font-mono">
                    {finding.code_snippet}
                  </pre>
                </div>
              )}

              {/* Risk Classification */}
              <div>
                <h3 className="text-sm font-medium mb-2">Risk Classification</h3>
                <div className={`rounded-lg border p-3 space-y-2 ${colors.border} ${colors.bg}`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{formatCategory(finding.category)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium">
                      {finding.confidence > 0 ? `${Math.round(finding.confidence * 100)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Detection</span>
                    <span className="font-medium">{finding.detection_layer}</span>
                  </div>
                  {finding.tool_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tool</span>
                      <span className="font-medium">{finding.tool_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remediation */}
              {finding.remediation && (
                <div>
                  <h3 className="text-sm font-medium mb-2">How to Fix</h3>
                  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-3">
                    <p className="text-sm text-green-800 dark:text-green-300">
                      {finding.remediation}
                    </p>
                  </div>
                </div>
              )}

              {/* OWASP & Compliance */}
              {(finding.owasp_agentic ||
                finding.owasp_mcp ||
                (finding.compliance_mapping && finding.compliance_mapping.length > 0)) && (
                <div>
                  <h3 className="text-sm font-medium mb-2">OWASP & Compliance</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.owasp_agentic && (
                      <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md border border-purple-200 dark:border-purple-800">
                        OWASP Agentic: {finding.owasp_agentic}
                      </span>
                    )}
                    {finding.owasp_mcp && (
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800">
                        OWASP MCP: {finding.owasp_mcp}
                      </span>
                    )}
                    {finding.compliance_mapping?.map((c, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700"
                      >
                        {c.framework}: {c.reference}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Pattern: {finding.pattern_id}</span>
              <span>ID: {finding.id?.slice(0, 8)}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

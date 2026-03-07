"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  FileCode,
  Server,
  Zap,
  Lock,
  Globe,
  Database,
  Terminal,
  Key,
} from "lucide-react";

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

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-600 bg-red-50 border-red-200",
  HIGH: "text-yellow-600 bg-yellow-50 border-yellow-200",
  MEDIUM: "text-orange-600 bg-orange-50 border-orange-200",
  LOW: "text-green-600 bg-green-50 border-green-200",
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

export default function SkillScanResultPage() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [result, setResult] = useState<SkillScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load results from sessionStorage (passed from scan page)
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
            <span className="text-yellow-600">{result.high_count} High</span>
            {" | "}
            <span className="text-orange-600">{result.medium_count} Medium</span>
            {" | "}
            <span className="text-green-600">{result.low_count} Low</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.findings.map((finding, i) => (
              <FindingCard key={finding.id || i} finding={finding} index={i + 1} />
            ))}
            {result.findings.length === 0 && (
              <div className="flex items-center gap-2 text-green-600 py-4 justify-center">
                <CheckCircle className="h-5 w-5" />
                <span>No security findings detected</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
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

function FindingCard({ finding, index }: { finding: SkillFinding; index: number }) {
  return (
    <div className={`p-4 rounded-lg border ${severityColor[finding.severity] || ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{index}</span>
            <span className="font-medium">{finding.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 border">
              {finding.severity}
            </span>
          </div>
          {finding.file && (
            <div className="text-xs text-muted-foreground mt-1">
              {finding.file}
              {finding.line ? `:${finding.line}` : ""}
              {finding.tool_name ? ` (Tool: ${finding.tool_name})` : ""}
            </div>
          )}
          <p className="text-sm mt-1">{finding.description}</p>
          {(finding.owasp_agentic || finding.owasp_mcp) && (
            <div className="flex gap-2 mt-2">
              {finding.owasp_agentic && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                  OWASP Agentic: {finding.owasp_agentic}
                </span>
              )}
              {finding.owasp_mcp && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  OWASP MCP: {finding.owasp_mcp}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{finding.detection_layer}</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Upload,
  Bot,
  Loader2,
  Shield,
  AlertCircle,
  CheckCircle2,
  FileArchive,
  X,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { createAPIClient, InkogAPIError, type InkogAPI } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type AIScanStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

interface AIScanReport {
  report: {
    agent_name: string;
    date: string;
    files_audited: number;
    detection_rules_total: number;
    detection_rules_applied: number;
    total_findings: number;
    total_clean: number;
  };
  agent_profile: {
    purpose: string;
    framework: string;
    language: string;
    architecture_summary: string;
    data_sources: string[];
    data_sinks: string[];
    external_integrations: string[];
    high_risk_operations: string[];
    is_multi_agent: boolean;
    trust_boundaries: string;
  };
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    clean: number;
    na: number;
  };
  findings: AIScanFinding[];
  clean_detections: {
    detection_id: string;
    rule_name: string;
    result: string;
    reason: string;
  }[];
  compliance_summary: {
    framework: string;
    relevant_findings: number[];
  }[];
  methodology: {
    approach: string;
    cross_verification: string;
    false_positive_elimination: string;
    confidence_calibration: string;
  };
}

interface AIScanFinding {
  finding_number: number;
  title: string;
  detection_id: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  affected_files: { file_path: string; line_numbers: string }[];
  proof: {
    file_path: string;
    start_line: number;
    end_line: number;
    code_snippet: string;
    language: string;
  }[];
  explanation: string;
  recommended_action: string;
  false_positive_risk: string;
  false_positive_rationale: string;
  compliance_mappings: { framework: string; reference: string }[];
}

const SEVERITY_COLORS = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-blue-100 text-blue-800 border-blue-200",
};

const SEVERITY_DOT_COLORS = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
};

export default function AIChecksPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { isAdmin, isLoading: userLoading } = useCurrentUser();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [agentName, setAgentName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<AIScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [report, setReport] = useState<AIScanReport | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setApi(createAPIClient(getToken));
  }, [getToken]);

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAdmin, userLoading, router]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".zip") || droppedFile.type === "application/zip")) {
      setFile(droppedFile);
      if (!agentName) {
        setAgentName(droppedFile.name.replace(/\.zip$/i, ""));
      }
    } else {
      setError("Please upload a .zip file");
    }
  }, [agentName]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!agentName) {
        setAgentName(selected.name.replace(/\.zip$/i, ""));
      }
      setError(null);
    }
  }, [agentName]);

  const pollStatus = useCallback(async (id: string) => {
    if (!api) return;
    try {
      const data = await api.admin.getAIScanStatus(id);
      if (data.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("completed");
        // The findings field contains the full AI report
        const scan = data.scan as any;
        if (scan?.findings) {
          setReport(typeof scan.findings === "string" ? JSON.parse(scan.findings) : scan.findings);
        }
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("failed");
        setError("AI analysis failed. Please try again.");
      }
    } catch (err) {
      // Don't stop polling on transient errors
      console.error("Poll error:", err);
    }
  }, [api]);

  const startScan = useCallback(async () => {
    if (!api || !file) return;
    setStatus("uploading");
    setError(null);

    try {
      const data = await api.admin.triggerAIScan(file, agentName || "AI Security Scan");
      setScanId(data.scan_id);
      setStatus("processing");

      // Start polling
      pollRef.current = setInterval(() => {
        pollStatus(data.scan_id);
      }, 5000); // Poll every 5 seconds
    } catch (err) {
      setStatus("failed");
      if (err instanceof InkogAPIError) {
        setError(err.message);
      } else {
        setError("Failed to start AI scan");
      }
    }
  }, [api, file, agentName, pollStatus]);

  const resetScan = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setAgentName("");
    setStatus("idle");
    setError(null);
    setScanId(null);
    setReport(null);
    setExpandedFinding(null);
  }, []);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/scan"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Security Checks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a repository archive for deep AI-powered security analysis
          </p>
        </div>
      </div>

      {/* Upload Section */}
      {status === "idle" && (
        <div className="space-y-4">
          {/* Zip Upload Area */}
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? "border-foreground bg-muted"
                  : "border-border hover:border-muted-foreground"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <FileArchive className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Drag & drop your repository .zip file here
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
                id="zip-upload"
              />
              <label
                htmlFor="zip-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Upload className="h-4 w-4" />
                Choose .zip file
              </label>
              <p className="text-xs text-muted-foreground mt-3">
                Max 50MB. The entire repository folder should be zipped.
              </p>
            </div>
          ) : (
            <div className="border rounded-xl p-6 space-y-4">
              {/* Selected file */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileArchive className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Agent name */}
              <div>
                <label className="block text-sm font-medium mb-1">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Sales Outreach Agent"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {/* Start Button */}
              <button
                onClick={startScan}
                className="w-full py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
              >
                <Bot className="h-5 w-5" />
                Run AI Security Analysis
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing State */}
      {(status === "uploading" || status === "processing") && (
        <div className="border rounded-xl p-12 text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">
              {status === "uploading" ? "Uploading repository..." : "AI Analysis in Progress"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {status === "uploading"
                ? "Sending your repository to the analysis server..."
                : "The AI agent is analyzing your code against 30+ detection rules. This typically takes 2-5 minutes."}
            </p>
          </div>
          {scanId && (
            <p className="text-xs text-muted-foreground font-mono">
              Scan ID: {scanId}
            </p>
          )}
        </div>
      )}

      {/* Failed State */}
      {status === "failed" && (
        <div className="border border-destructive/20 rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Analysis Failed</h3>
            <p className="text-muted-foreground text-sm mt-1">{error || "An unknown error occurred"}</p>
          </div>
          <button
            onClick={resetScan}
            className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {status === "completed" && report && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold">{report.report.agent_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {report.report.files_audited} files analyzed &middot; {report.report.total_findings} findings &middot; {report.report.total_clean} clean rules
                </p>
              </div>
            </div>
            <button
              onClick={resetScan}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-background transition-colors"
            >
              New Scan
            </button>
          </div>

          {/* Severity Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <div key={sev} className="border rounded-lg p-4 text-center">
                <div className={`inline-flex h-3 w-3 rounded-full ${SEVERITY_DOT_COLORS[sev.toUpperCase() as keyof typeof SEVERITY_DOT_COLORS]} mb-2`} />
                <p className="text-2xl font-bold">{report.severity_summary[sev]}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{sev}</p>
              </div>
            ))}
          </div>

          {/* Agent Profile */}
          <div className="border rounded-xl overflow-hidden">
            <div className="p-4 bg-muted border-b">
              <h3 className="font-semibold">Agent Profile</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-muted-foreground">Framework</span>
                  <p className="font-medium">{report.agent_profile.framework}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Language</span>
                  <p className="font-medium">{report.agent_profile.language}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Multi-Agent</span>
                  <p className="font-medium">{report.agent_profile.is_multi_agent ? "Yes" : "No"}</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Purpose</span>
                <p className="mt-0.5">{report.agent_profile.purpose}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Architecture</span>
                <p className="mt-0.5">{report.agent_profile.architecture_summary}</p>
              </div>
              {report.agent_profile.high_risk_operations.length > 0 && (
                <div>
                  <span className="text-muted-foreground">High-Risk Operations</span>
                  <ul className="mt-0.5 list-disc list-inside text-sm">
                    {report.agent_profile.high_risk_operations.map((op, i) => (
                      <li key={i}>{op}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Findings */}
          <div className="border rounded-xl overflow-hidden">
            <div className="p-4 bg-muted border-b">
              <h3 className="font-semibold">
                Findings ({report.findings.length})
              </h3>
            </div>
            <div className="divide-y">
              {report.findings.map((finding) => (
                <div key={finding.finding_number} className="group">
                  <button
                    onClick={() => setExpandedFinding(
                      expandedFinding === finding.finding_number ? null : finding.finding_number
                    )}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[finding.severity]}`}>
                        {finding.severity}
                      </span>
                      <span className="font-medium text-sm flex-1">{finding.title}</span>
                      <span className="text-xs text-muted-foreground">{finding.category}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {finding.affected_files.map((af, i) => (
                        <span key={i} className="font-mono">{af.file_path}:{af.line_numbers}</span>
                      ))}
                    </div>
                  </button>

                  {expandedFinding === finding.finding_number && (
                    <div className="px-4 pb-4 space-y-3 border-t bg-muted/30">
                      <div className="pt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Explanation</h4>
                        <p className="text-sm">{finding.explanation}</p>
                      </div>

                      {finding.proof.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Proof</h4>
                          {finding.proof.map((p, i) => (
                            <div key={i} className="mt-2">
                              <p className="text-xs text-muted-foreground font-mono mb-1">
                                {p.file_path}:{p.start_line}-{p.end_line}
                              </p>
                              <pre className="bg-background border rounded-lg p-3 text-xs overflow-x-auto">
                                <code>{p.code_snippet}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommended Action</h4>
                        <p className="text-sm">{finding.recommended_action}</p>
                      </div>

                      {finding.compliance_mappings.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Compliance</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {finding.compliance_mappings.map((cm, i) => (
                              <span key={i} className="px-2 py-0.5 bg-muted border rounded text-xs">
                                {cm.framework}: {cm.reference}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>Confidence: {finding.confidence}</span>
                        <span>FP Risk: {finding.false_positive_risk}</span>
                        <span>Rule: {finding.detection_id}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {report.findings.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No security findings detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Clean Detections */}
          {report.clean_detections.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="p-4 bg-muted border-b">
                <h3 className="font-semibold">
                  Clean Detections ({report.clean_detections.length})
                </h3>
              </div>
              <div className="divide-y">
                {report.clean_detections.map((clean, i) => (
                  <div key={i} className="p-3 flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{clean.rule_name}</span>
                      <span className="text-muted-foreground mx-1.5">&middot;</span>
                      <span className="text-muted-foreground">{clean.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Summary */}
          {report.compliance_summary.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="p-4 bg-muted border-b">
                <h3 className="font-semibold">Compliance Summary</h3>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.compliance_summary.map((cs, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <p className="font-medium text-sm">{cs.framework}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cs.relevant_findings.length} relevant finding{cs.relevant_findings.length !== 1 ? "s" : ""}:
                      #{cs.relevant_findings.join(", #")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

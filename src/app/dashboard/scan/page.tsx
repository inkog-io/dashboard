"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
  Terminal,
  ArrowRight,
} from "lucide-react";

import {
  createAPIClient,
  InkogAPIError,
  type Finding,
  type ScanResult,
  type InkogAPI,
} from "@/lib/api";
import { GovernanceScore } from "@/components/GovernanceScore";
import { ComplianceMapping } from "@/components/ComplianceMapping";
import { TopologyMapVisualization } from "@/components/TopologyMap";
import { FindingCard } from "@/components/FindingCard";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { FindingsToolbar, type SeverityFilter } from "@/components/FindingsToolbar";

export default function ScanPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Findings panel state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Filter findings based on severity and search
  const filteredFindings = useMemo(() => {
    if (!result?.findings) return [];

    return result.findings.filter((finding) => {
      // Severity filter
      if (severityFilter !== "ALL" && finding.severity !== severityFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          finding.message?.toLowerCase().includes(query) ||
          finding.pattern_id?.toLowerCase().includes(query) ||
          finding.file?.toLowerCase().includes(query) ||
          finding.cwe?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [result?.findings, severityFilter, searchQuery]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const allowedExtensions = [
        "py",
        "js",
        "ts",
        "jsx",
        "tsx",
        "go",
        "java",
        "rb",
        "json",
        "yaml",
        "yml",
        "md",
      ];
      return allowedExtensions.includes(ext) || file.type.startsWith("text/");
    });

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setError(null);
      setResult(null);
    }
  }, []);

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        setFiles((prev) => [...prev, ...selectedFiles]);
        setError(null);
        setResult(null);
      }
    },
    []
  );

  // Remove a file from the list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setSeverityFilter("ALL");
    setSearchQuery("");
  }, []);

  // Run the scan
  const runScan = useCallback(async () => {
    if (!api || files.length === 0) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setSelectedFinding(null);
    setSeverityFilter("ALL");
    setSearchQuery("");

    try {
      const scanResult = await api.scan.upload(files);
      setResult(scanResult);
    } catch (err) {
      if (err instanceof InkogAPIError) {
        setError(`${err.message} (${err.code})`);
      } else {
        setError(err instanceof Error ? err.message : "Scan failed");
      }
    } finally {
      setScanning(false);
    }
  }, [api, files]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Agent Governance Scanner
        </h1>
        <p className="text-gray-600 mt-1">
          Verify human oversight, authorization controls, and audit trails in
          your AI agents
        </p>
        <p className="text-xs text-gray-500 mt-1">
          EU AI Act Article 14 deadline: August 2, 2026
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Privacy Notice</p>
          <p>
            Files are processed ephemerally and not stored. For maximum privacy,
            use the CLI for local-only scanning.
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drag & drop code files here
        </p>
        <p className="text-sm text-gray-500 mb-4">or click to browse</p>
        <input
          type="file"
          multiple
          accept=".py,.js,.ts,.jsx,.tsx,.go,.java,.rb,.json,.yaml,.yml,.md"
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          <FileCode className="h-4 w-4" />
          Select Files
        </label>
        <p className="text-xs text-gray-400 mt-4">
          Supported: Python, JavaScript, TypeScript, Go, Java, Ruby, JSON, YAML
        </p>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-900">
              Selected Files ({files.length})
            </h3>
            <button
              onClick={clearFiles}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={runScan}
            disabled={scanning}
            className="mt-4 w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                Start Scan
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Scan Complete
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {result.files_scanned}
                </p>
                <p className="text-xs text-gray-500 uppercase">Files Scanned</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {result.findings_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">Total Findings</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {result.critical_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">Critical</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {result.high_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">High</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Scanned {result.lines_of_code.toLocaleString()} lines of code in{" "}
              {result.scan_duration || "0ms"}
            </div>
          </div>

          {/* Governance Section */}
          {(result.governance_score !== undefined ||
            result.eu_ai_act_readiness) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GovernanceScore
                score={result.governance_score}
                readiness={result.eu_ai_act_readiness}
              />
              <ComplianceMapping
                articleMapping={result.article_mapping}
                frameworkMapping={result.framework_mapping}
              />
            </div>
          )}

          {/* Agent Topology Visualization */}
          {result.topology_map && (
            <TopologyMapVisualization topology={result.topology_map} />
          )}

          {/* CLI Upsell Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Terminal className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">
                  Want to run this in CI/CD?
                </p>
                <p className="text-sm text-gray-600">
                  Get your API key and integrate with GitHub Actions, GitLab CI,
                  and more.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/api-keys"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              Get API Key
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Findings Section */}
          {result.findings.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-5 border-b border-gray-100">
                <FindingsToolbar
                  totalCount={result.findings_count}
                  criticalCount={result.critical_count}
                  highCount={result.high_count}
                  mediumCount={result.medium_count}
                  lowCount={result.low_count}
                  selectedSeverity={severityFilter}
                  onSeverityChange={setSeverityFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>

              {/* Findings List */}
              <div className="divide-y divide-gray-100">
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding, index) => (
                    <FindingCard
                      key={finding.id || index}
                      finding={finding}
                      onClick={() => setSelectedFinding(finding)}
                    />
                  ))
                ) : (
                  <div className="px-5 py-8 text-center text-gray-500">
                    No findings match your filters
                  </div>
                )}
              </div>

              {/* Results count */}
              {filteredFindings.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                  Showing {filteredFindings.length} of {result.findings_count}{" "}
                  findings
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-800">
                No vulnerabilities found!
              </p>
              <p className="text-sm text-green-600 mt-1">
                Your code passed all security checks.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Finding Details Panel (Slide-out) */}
      <FindingDetailsPanel
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}
